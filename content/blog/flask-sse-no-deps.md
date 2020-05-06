+++
date = "2020-05-04"
draft = false
title = "Server-sent events in Flask without extra dependencies"
+++

[Server-sent events (SSE)](https://www.wikiwand.com/en/Server-sent_events) is a mechanism for sending updates from a server to a client. The fundamental difference with [WebSockets](https://www.wikiwand.com/en/WebSocket) is that the communication only goes in one direction. In other words, the client cannot send information to the server. For many usecases this is all you might need. Indeed, if you just want to receive notifications/updates/messages, then using a WebSocket is overkill. Once you've implemented the SSE functionality on your server, then all you need on a client that uses JavaScript is an [`EventSource`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource). Trust me, it's really simple.

I am a data scientist by training, and therefore I am not an expert in web technologies. I came across SSE because I wanted to implement a notification system for a [machine learning deployment tool](https://github.com/creme-ml/chantilly) I'm working on. The tool uses Flask, and so I stumbled on the [`flask-sse`](https://github.com/singingwolfboy/flask-sse) package. It looks great, but it requires using Redis. I like Redis, but I don't like the idea of having to add a new dependency to my application for implementing a single feature. If I was the only person that was going to use the application, then I would be fine with it. However, the application I'm building is destined to be distributed as a package, and therefore I don't want to force users to install Redis.

The `flask-sse` package requires having Redis installed because it needs a storage backend with implements the [publish-subscribe pattern](https://www.wikiwand.com/en/Publish%E2%80%93subscribe_pattern) -- which is commonly abbreviated to "pubsub". The idea of this pattern is that messages are not directly sent to listeners. Instead, a message is sent to a middleware who's responsibility is to relay the message to the listeners. The advantage is that the message emitter doesn't have to worry about the details. In particular, it doesn't have to check that the message gets dispatched correctly. These concerns are rather delegated to the middleware. There are many great implementations that can take charge of this for you, including Redis. However, if you're not too concerned about performance, then you can easily do this yourself in Flask without any extra dependencies. Let me demonstrate.

To start off, I'm going to create a file named `app.py` which will contain all the Flask server logic.

```py
import flask

app = flask.Flask(__name__)

@app.route('/')
def hello_world():
    return 'Hello, World!'
```

In order to implement the pubsub pattern, I'm going to define a `MessageAnnouncer` class.

```py
import queue

class MessageAnnouncer:

    def __init__(self):
        self.listeners = []

    def listen(self):
        q = queue.Queue(maxsize=5)
        self.listeners.append(q)
        return q

    def announce(self, msg):
        for i in reversed(range(len(self.listeners))):
            try:
                self.listeners[i].put_nowait(msg)
            except queue.Full:
                del self.listeners[i]
```

As you can see, `MessageAnnouncer` has two methods. The first one, which is `listen`, will be called by clients when they want to receive a notification every time something new happens. When a client starts listening, we simply append a [`queue.Queue`](https://docs.python.org/3/library/queue.html#queue.Queue) to the list of listeners. The `queue` module is part of Python's standard library; it has the desirable property of being thread-safe by implementing locking mechanisms under the hood.

The second method of `MessageAnnouncer` is `announce`. It's responsability is take an input message and dispatch to every listener. Additionally, it removes listeners that don't "seem" to be listening anymore. By this I mean that if a message queue is full, then it's probably because the queue isn't being read from anymore. In the `listen` method, the maximum size of each queue is set to 5, which should give ample time to read a message before the next one arrives. If we set the maximum size to 1, then a queue might potentially be full because the associated listener doesn't have enough time to read each message before the next one arrives. Therefore, increasing the size of the queue gives some leeway so that rapid bursts of notifications don't clog the message queue. Note that we loop in reversed order because deleted a listener will affect the index values of all subsequent listeners.

Now for the easy part, which is to use the `MessageAnnouncer`. The first step is to instantiate it.

```py
announcer = MessageAnnouncer()
```

We'll only be using one `MessageAnnouncer` for the purpose of this example, but in practice you can use as many you like. For instance, you could create one instance for each user you might have. But let's not disgress. Now, in order to implement the SSE protocol, we need to send events that follow a certain format. This format is slightly obscure, but is quite well described [here](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format). Here is an example of what each message should look like:

```
event: Jackson 5\\ndata: {"abc": 123}\\n\\n
```

The carriage returns are important because they delimitate the beginnings and ends of consecutive messages. Here is little helper function to format a message to follow this convention:

```py
def format_sse(data: str, event=None) -> str:
    msg = f'data: {data}\n\n'
    if event is not None:
        msg = f'event: {event}\n{msg}'
    return msg
```

The `event` parameter is optional, it allows defining topics to which clients can subscribe to. This avoids having to define one message queue for each topic. We can now pass messages to our message announcer, which will take of dispatching them. Let's create a `/ping` route which does just that.

```py
@app.route('/ping')
def ping():
    msg = format_sse(data='pong')
    announcer.announce(msg=msg)
    return {}, 200
```

Because we're using the correct message format, these messages should property get received by any decently written client function. However, we first have to define a `/listen` route that allows listeners to subscribe in order to receive messages. Here goes:

```py
@app.route('/listen', methods=['GET'])
def listen():

    def stream():
        messages = announcer.listen()  # returns a queue.Queue
        while True:
            msg = messages.get()  # blocks until a new message arrives
            yield msg

    return flask.Response(stream(), mimetype='text/event-stream')
```

The previous is a bit esoteric because it's not common to return a function in a Flask response. However, this pattern is [quite well documented](https://flask.palletsprojects.com/en/1.1.x/patterns/streaming/) and works perfectly. Effectively, sending a `GET` request to the `/listen` route results in a response that takes an infinite amount of time. The `messages.get()` call blocks until a new message is put into the queue. Once a message arrives, it is sent through the HTTP connection in progress. The important thing to understand is that this response will never terminate, and thus will hang forever. Consequently, if you're running Flask with a single process, then it will block forever. Therefore, you need to make sure you're Flask in threaded mode -- which is done by default in recent versions. Moreover, if you're going to use a WSGI server other than Flask's default one, such as [Gunicorn](https://gunicorn.org/), then you need to make sure you're asynchronous workers. For example, in Gunicorn, this can be one setting the [`worker_class`](https://docs.gunicorn.org/en/stable/settings.html#worker-class) parameter to something else than `'sync'`.

We may now run the server:

```sh
export FLASK_APP=app.py
export FLASK_ENV=development
flask run
```

In a separate terminal session, we can run a `listen.py` script which will subscribe to the `/listen` route. We can do this with the [`sseclient`](https://pypi.org/project/sseclient/) library, which is a thin wrapper on top of [`requests`](https://requests.readthedocs.io/en/master/):

```py
import json
import sseclient

messages = sseclient.SSEClient('http://localhost:5000/listen')

for msg in messages:
    print(msg)
```

Finally, we can use a third terminal session to run another script which will call the `/ping` route once every second:

```py
import time
import requests

while True:
    requests.get('http://localhost:5000/ping')
    time.sleep(1)
```

You should now see a steady stream of `pong` messages in the terminal where the `listen.py` script is being ran. That's it, you're done! You can find a copy of these instructions along with the code in [the accompaying GitHub repository](https://github.com/MaxHalford/flask-sse-no-deps).

There's probably some room improvement. For instance, it would be nice to perform the event emission with [Flask signals](https://flask.palletsprojects.com/en/1.1.x/signals/), but I haven't been able to make it work yet. Additionally, I'm not 100% how to make this work seamlessly behind a reverse proxy such as [Nginx](https://www.nginx.com/). Indeed, it seems that there are some [specific settings](https://serverfault.com/questions/801628/for-server-sent-events-sse-what-nginx-proxy-configuration-is-appropriate) have to be chosen because of the long polling nature of the listening routes. Nonetheless, this implementation has been working quite well for me. Plus, I like the fact that it's a standalone solution. However, there might be some subtlety that I have missed and that would justify using something like Redis, in which case I would love some feedback.
