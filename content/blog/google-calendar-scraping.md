+++
date = "2025-10-12"
title = "Scraping Google Calendar events"
tags = ['python', 'scraping']
+++

At my day job we deal with enterprise customers. They pay us a subscription fee, and in return we help them in various ways to reduce their carbon footprint. To keep the boat afloat, we need to make some money. We shouldn't spend more money than we make. So we need to keep track of our revenue and costs. Our gross margin is `(revenue - cost) / revenue`, where the cost is mostly the salaries of our employees.

We want to track our gross margin on a weekly basis, per customer. We need automation in order to do that. Time tracking is a pain, but one part which is quite objective is the time spent in meetings. All our events are in Google Calendar, so I figured it should be possible to count the hours spent in meetings per customer, and tally that up on a weekly basis.

Turns out, I didn't find a ready-made solution for that. We use Fivetran at Carbonfact, but their connector only appears to be able to scrape the calendar of the Fivetran users, not of other users in the same Google Suite domain. So I wrote my own script to scrape the calendars of all our employees, and store the events in BigQuery. I rather dislike the fact this is a custom script that we have to maintain ourselves. But *c'est la vie*.

A few things about the script:

- I used [Google Calendar Simple API (`gsca`)](https://google-calendar-simple-api.readthedocs.io/en/latest/#) -- it's excellent and avoids dealing with the Google API client library directly.
- There are two service accounts involved:
  - One for accessing the Google Calendar API. This one needs to have [domain-wide delegation](https://support.google.com/a/answer/162106?hl=en) enabled and the necessary scopes granted by a G Suite admin. The credentials are read from the `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON` environment variable.
  - One for writing to BigQuery. This one can be a regular service account with the `BigQuery Data Editor` role. The script uses Application Default Credentials (ADC), which means essentially you have to be logged in with `gcloud auth application-default login`, or set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to a service account key file.
- The email addresses of the employees whose calendars should be scraped are hardcoded in the `EMAIL_ACCOUNTS` list. Not everyone at my company meets with customers, so I only have to include those who do.
- Calendar events are uploaded to BigQuery at the end of the script. This can easily be customized.
- There is one row per event, identified by its event ID. Meeting attendees are stored as a repeated field (array of structs).
- This script is intended to be run daily. It checks the last event in BigQuery and only scrapes events since then. You can also provide a `--since YYYY-MM-DD` argument to override this.
- Events are scraped concurrently within a day, but days are processed sequentially. This is to avoid hitting Google API rate limits.
- There's exponential backoff and retrying when scraping events for a user fails.
- The important line of code is `GOOGLE_CALENDAR_CREDENTIALS.with_subject(email_account)` -- this is what allows the service account with domain-wide delegation to impersonate other users in the domain.

```py
import argparse
import dataclasses
import datetime as dt
import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

import dotenv
import pandas as pd
import pandas_gbq
import tenacity
from gcsa.google_calendar import GoogleCalendar
from google.oauth2 import service_account

dotenv.load_dotenv()

EMAIL_ACCOUNTS = [
    "m@carbonfact.com",
    "f@carbonfact.com",
    "a@carbonfact.com",
    "k@carbonfact.com"
]
WRITE_PROJECT_ID = "google-calendar-import"
WRITE_TABLE_ID = "google_calendar_import.google_calendar"
WRITE_PROJECT_LOCATION = "EU"

# Read service account credentials from environment variable
service_account_json = os.environ["GCAL_SERVICE_ACCOUNT_JSON"]

# This will return a Credentials object and the project ID (if available)
# CREDENTIALS, project_id = google.auth.default(scopes=SCOPES)
GOOGLE_CALENDAR_CREDENTIALS = service_account.Credentials.from_service_account_info(
    json.loads(service_account_json),
    scopes=[
        "https://www.googleapis.com/auth/calendar.readonly",
    ],
)

# We don't provide credentials because we want to fall back to ADC. Meanwhile the
# CREDENTIALS variable is used for accessing the Google Calendar API.
BIQ_QUERY_CREDENTIALS = None


def determine_since_when_search() -> dt.date:
    last_event = pandas_gbq.read_gbq(
        f"""
        SELECT *
        FROM {WRITE_TABLE_ID}
        ORDER BY start_at DESC
        LIMIT 1
        """,
        project_id=WRITE_PROJECT_ID,
        location=WRITE_PROJECT_LOCATION,
        credentials=BIQ_QUERY_CREDENTIALS,
    )
    since = last_event.iloc[0].start_at.date()  # type: ignore
    return since


@dataclasses.dataclass
class Attendee:
    email: str
    response_status: str


@dataclasses.dataclass
class Event:
    event_id: str
    title: str
    attendees: list[Attendee]
    start_at: dt.datetime
    end_at: dt.datetime
    timezone: str


def list_events(email_account: str, date: dt.date) -> list[Event]:
    delegated_credentials = GOOGLE_CALENDAR_CREDENTIALS.with_subject(email_account)
    calendar = GoogleCalendar(
        email_account,
        credentials=delegated_credentials,  # type: ignore
        read_only=True,
    )
    events = []

    for event in calendar.get_events(
        time_min=date, time_max=date + dt.timedelta(days=1), single_events=True
    ):
        if not event.attendees:
            continue

        # Skip full-day events
        if type(event.start) is dt.date and type(event.end) is dt.date:
            continue

        # Some recurring events slip through the (time_min, time_max) filter. We could do
        # event.start.date() != date, but that would be a bit too strict with regard to timezones.
        # So we check that the event is not outside a ±1 day window. In any case, we can always
        # deduplicate events by ID later!
        event_start_date = (
            event.start.date() if isinstance(event.start, dt.datetime) else event.start
        )
        event_end_date = event.end.date() if isinstance(event.end, dt.datetime) else event.end
        if (
            event_start_date > date + dt.timedelta(days=1)
            or event_end_date < date - dt.timedelta(days=1)  # type: ignore
        ):
            continue

        events.append(
            Event(
                event_id=event.id,  # type: ignore
                title=event.summary,  # type: ignore
                attendees=[
                    Attendee(email=attendee.email, response_status=attendee.response_status)  # type: ignore
                    for attendee in event.attendees
                ],
                start_at=event.start,  # type: ignore
                end_at=event.end,  # type: ignore
                timezone=event.timezone,
            )
        )

    return events


@tenacity.retry(
    wait=tenacity.wait_exponential(
        multiplier=1, min=2, max=30
    ),  # exponential backoff: 2s, 4s, 8s...
    stop=tenacity.stop_after_attempt(5),  # try up to 5 times
)
def safe_list_events(email, day):
    return list_events(email, day)


def wrapped_list_events(email, day):
    return email, day, safe_list_events(email, day)


def get_events_for_day(day: dt.date) -> dict[str, Event]:
    executor = ThreadPoolExecutor()
    futures = []
    for email_account in EMAIL_ACCOUNTS:
        futures.append(executor.submit(wrapped_list_events, email_account, day))

    day_events = {}
    for future in as_completed(futures):
        email_account, day, events = future.result()
        if not events:
            continue
        logging.info(f"{day} ~ {len(events):,d} event(s) for {email_account}")
        for event in events:
            logging.info(
                f"* {event.title} ({event.start_at.strftime('%H:%M')} - {event.end_at.strftime('%H:%M')})"
            )
            day_events[event.event_id] = event

    return day_events


def main(since_date: dt.date | None = None):
    # Determine since when to collect events
    if since_date:
        since = since_date
    else:
        since = determine_since_when_search()
    logging.info(f"Collecting events since {since}")

    # Collect new events
    new_events = {}
    day = since
    today = dt.date.today()
    while day <= today:
        day_events = get_events_for_day(day)
        logging.info(f"{day} ~ {len(day_events):,d} event(s) in total")
        new_events.update(day_events)
        day += dt.timedelta(days=1)

    # Write new events to BigQuery
    new_events_df = pd.DataFrame.from_records(
        [
            {
                **dataclasses.asdict(event),
                "attendees": [dataclasses.asdict(attendee) for attendee in event.attendees],
            }
            for event in new_events.values()
        ]
    )

    pandas_gbq.to_gbq(
        new_events_df,
        WRITE_TABLE_ID,
        project_id=WRITE_PROJECT_ID,
        location=WRITE_PROJECT_LOCATION,
        if_exists="append",
        credentials=BIQ_QUERY_CREDENTIALS,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Scrape and store Google Calendar events"
    )
    parser.add_argument(
        "--since",
        type=dt.date.fromisoformat,
        help="Start date for event collection in YYYY-MM-DD format. If not provided, will use determine_since_when_search()",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    logging.getLogger("googleapiclient.discovery_cache").setLevel(logging.ERROR)
    main(args.since)
    logging.info("Google Calendar scraping completed ✅")
```
