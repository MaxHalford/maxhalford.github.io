+++
date = "2026-11-15"
title = "Enabling agentic BI with nao at turbopuffer"
tags = ['data-eng', 'llm']
draft = true
+++

Business intelligence, data analytics, or whatever you call the act of answering questions with data, is going through a watershed moment.

Whether you like it or not, people find it easier to ask questions to their agent than to their human colleagues. This affects how a Data team operates. Our purpose is still to enable teammates to access the right knowledge in a timely manner. But if we're not involved in the process anymore, the way we fulfill our mission statement has to change.

One thing that can help is meeting colleagues where they work. They don't consume dashboards anymore. They either use a terminal or the ChatGPT/Claude apps. Anything else is friction, or will eventually disappear. Instead of polishing dashboards, I see a world where the Data team ships internal [mods](https://code.claude.com/docs/en/plugins/mods/overview) and [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview).

More importantly, if we waste less time answering questions, we can spend more time solidifying the foundations. It has never been so valuable to invest in analytics engineering. If you have a reliable data model, you can let agents rip over them and worry less about the quality of their answers. But this is nothing new; it's always been a good thing to have a sound data model.

The question of the hour is how exactly to enable so called "agentic BI". The naive solution is giving the agent read access to the data warehouse. That's rather limiting, because the tables only give a partial view of the underlying data model. The agent can reverse engineer relationships from table contents, but that's more akin to archaeology than analytics.

There's also the matter of discoverability. How do you guarantee new employees are pointing their agents in the right direction? How do you make sure everyone is looking at the same numbers at any given point in time? How can you monitor what people are searching for to iterate on the data model?

I'm the second hire in turbopuffer's Data team. The first hire had set up something that I thought was clumsy, but in hindsight didn't seem so bad. CITE MARC ANDREESEEN DUMB IDEA
