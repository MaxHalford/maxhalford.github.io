# Personal website

Hey man, it's you back when you first made this website.

To make changes you first have to [install Hugo](https://gohugo.io/getting-started/installing/). Then run `hugo serve --watch` and head to `localhost:1313`.

To publish the changes just push to the `dev` branch, Travis will take care of compiling the website and pushing it to the `master` branch.

## Ideart

Add a post under `content/blog/thoughts/` and give it an `ideart` image:

```yaml
ideart:
  image: /img/blog/ideart/my-sticker.webp
  alt: A useful description of the sticker artwork
  width: 1000
  height: 1000
```

Run Hugo in the `development` environment, then drag, resize, and tilt the stickers directly on the page. Use **Copy layout** and replace `data/ideart.json` with the copied JSON to publish those positions. Posts without `ideart.image` stay off the wall; development builds show a warning for each one.
