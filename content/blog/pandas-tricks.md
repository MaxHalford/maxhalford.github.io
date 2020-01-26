+++
date = "2019-11-05"
draft = true
title = "Some useful pandas tricks"
+++

## Rolling counts

```python
df.groupby(['id', 'moment']).agg({'variable': 'size'}).groupby('id').cumsum()
```

## Largest number of consecutive null values

```python
weather.air_temperature.isnull().astype(int).groupby(weather.air_temperature.notnull().astype(int).cumsum()).sum().max()
```

## Aggregates on shifted windows

```python
import pandas as pd


AGGS = [
    ('meter_reading', 5, ['building_id', 'meter', 'day'], ['mean', 'std']),
    ('meter_reading', 5, ['building_id', 'meter', 'hour'], ['mean', 'std']),
    ('meter_reading', 5, ['building_id', 'meter', 'day', 'hour'], ['mean', 'std']),
]

df = pd.read_pickle('data/train_test.pkl')

for on, window, by, hows in AGGS:

    print(f'Doing {" and ".join(hows)} with window {window} on {on} by {" and ".join(by)}')

    by_name = by if isinstance(by, str) else "_and_".join(by)
    agg = df.groupby(by)[on]\
            .apply(lambda x: x.shift(1).rolling(window=window).agg(hows))\
            .rename(columns={
                how: f'{on}_{how}_of_previous_{window}_by_{by_name}'
                for how in hows
            })

    df = df.join(agg)

for feature in agg:
    df[feature] = df.groupby(by)[feature].ffill()
```

## Saving to Dropbox

```python
import dropbox

def to_dropbox(dataframe, path, token):

    dbx = dropbox.Dropbox(token)

    df_string = dataframe.to_csv(index=False)
    db_bytes = bytes(df_string, 'utf8')
    dbx.files_upload(
        f=db_bytes,
        path=path,
        mode=dropbox.files.WriteMode.overwrite
    )
```
