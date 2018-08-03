+++
date = "2018-04-26"
draft = false
title = "Stella triangles with JavaScript"
+++

Around the same time last year I visited the [San Francisco Museum of Modern Art](https://www.sfmoma.org/). [Frank Stella](https://www.wikiwand.com/en/Frank_Stella)'s compositions really caught my eye. When I saw them I started thinking about how I could write a computer program to imitate his work. In this post I'm going to attempt to reproduce his so-called *V Series*.

![1](/img/blog/stella-triangles/1.jpg)

![2](/img/blog/stella-triangles/2.jpg)

Nice and simple right? Indeed in a lot of his work Frank Stella uses straight lines without much randomness. There are quite a few prints in the V Series. However in each one of them the common denominator is a single triangle. If we have a routine for drawing one triangle then we can use to make compositions. As always let's start by creating a canvas.

```html
<canvas id="doodle" width="900" height="600"></canvas>
```

```javascript
var canvas = document.getElementById('doodle')
var ctx = canvas.getContext('2d')
```

A triangle can be defined by the three points it possesses so let's define a `Point` class.

```javascript
class Point {
  constructor (x, y) {
    this.x = x
    this.y = y
  }
}
```

The triangles Frank Stella uses are equilateral; that is their side lengths are equal and each angle is 60 degrees. Another property we can notice is that each triangle has an orientation that indicates where the white lines should be drawn. The side length of an equilateral triangle can be guessed by the position of it's points, but we might as well store it when we create a triangle.

```javascript
class Triangle {
  constructor (a, b, c, angle, sideLength) {
    this.a = a
    this.b = b
    this.c = c
    this.angle = angle
    this.sideLength = sideLength
  }
}
```

We could use the previous definition to create triangles but we would have to work out the positions of each point manually. Indeed if we know the position of one of the points, the direction, and the side length, then we can automatically determine the position of the other points with a bit of trigonometry. We're going to assume that we know where to position `a` and we want our program to determine the position of `b` and `c` given an angle and a side length. We have to use a convention to determine if we're going clockwise or not. I used the following convention:

![3](/img/blog/stella-triangles/3.png)

Here is the code for creating an equilateral triangle:

```javascript
function degreesToRadians(angle) {
  return angle * Math.PI / 180
}

function newTriangle(a, angle, sideLength) {
  var b = new Point(
    sideLength * Math.cos(degreesToRadians(angle - 30)) + a.x,
    sideLength * Math.sin(degreesToRadians(angle - 30)) + a.y
  )
  var c = new Point(
    sideLength * Math.cos(degreesToRadians(angle + 30)) + a.x,
    sideLength * Math.sin(degreesToRadians(angle + 30)) + a.y
  )
  return new Triangle(a, b, c, angle, sideLength)
}
```

We make use of the fact that in a triangle each angle is 60 degrees. This means that if we start from `a` we can substract 30 degrees and deduce the position of `b`. Likewhise we can do the same operation to find `c` by adding 30 degrees to the input angle. By default the cosine and sine functions will give the positions of the points on the [unit circle](https://www.wikiwand.com/en/Unit_circle). We simply have to add the position of `a` to each point and multiply the result by `sideLength`. After all we're simply dealing with vectors.

Now let's add to the `Triangle` class a `draw` method which draws the triangle on a given canvas.

```javascript
class Triangle {
  draw (ctx, color) {
    ctx.beginPath();
    ctx.moveTo(this.a.x, this.a.y)
    ctx.lineTo(this.b.x, this.b.y)
    ctx.lineTo(this.c.x, this.c.y)
    ctx.lineTo(this.a.x, this.a.y)
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();
  }
}

newTriangle(new Point(200, 500), -30, 500).draw(ctx, '#336699')
```

![4](/img/blog/stella-triangles/4.png)

We're getting somewhere. The next step is to draw the white lines. The way I approched this is to scale down the original triangle to obtain a smaller version of it. Then I only have to draw the edges in thick white and repeat the process with an even smaller triangle. Specifically we want to "walk" from `a` to the point that is between `b` and `c` (we'll call it `d`) and scale down the triangle. The distance between `a` and `d` can be obtained with Pythagoras's theorem:

$$\lVert a, d \rVert = \sqrt{\lVert a, b \rVert^2} - \frac{\lVert a, b \rVert}{2}$$

$\frac{\lVert a, b \rVert}{2}$ is nothing more than half the side of the triangle. It's quite easy to grasp by looking at one of the above triangles and splitting it in half.

```javascript
class Triangle {
  draw (ctx, color, steps, stepSize, lineWidth) {

    // Draw triangle outline

    ctx.beginPath();
    ctx.moveTo(this.a.x, this.a.y)
    ctx.lineTo(this.b.x, this.b.y)
    ctx.lineTo(this.c.x, this.c.y)
    ctx.lineTo(this.a.x, this.a.y)
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();

    // Draw inner lines

    var height = Math.sqrt(Math.pow(this.height, 2)) - this.height / 2
    var d = new Point((this.b.x + this.c.x) / 2, (this.b.y + this.c.y) / 2)

    ctx.strokeStyle = 'white'
    ctx.lineWidth = lineWidth

    for (var i = 1; i <= steps; i++) {
      var r = (stepSize * i) / height
      var p = new Point(
        this.a.x + (d.x - this.a.x) * r,
        this.a.y + (d.y - this.a.y) * r,
      )
      var innerTriangle = newTriangle(p, this.angle, this.height - r * this.height)
      ctx.beginPath();
      ctx.moveTo(innerTriangle.a.x, innerTriangle.a.y)
      ctx.lineTo(innerTriangle.b.x, innerTriangle.b.y)
      ctx.moveTo(innerTriangle.a.x, innerTriangle.a.y)
      ctx.lineTo(innerTriangle.c.x, innerTriangle.c.y)
      ctx.stroke();
      ctx.closePath();
    }
  }
}
```

We start by computing the height of the triangle as defined above. We also determine the position of `d` by averaging the coordinates of `b` and `c`. Then we simply loop a fixed number of times and draw the white lines at each iteration. To draw a white line we create a new triangle who's first point (called `p`) starts "somewhere" on the line between `a` and `b`. The "somewhere" is determined by the ratio `r` which is obtained by interpolating on the segment between `a` and `d`. Let's see what this looks like.

```javascript
newTriangle(new Point(200, 500), -30, 500).draw(ctx, '#336699', 8, 20, 3)
```

![5](/img/blog/stella-triangles/5.png)

Nice! Now we only have to add the white hollow part of the triangle. This can easily be done with the same logic as above. However instead of only drawing the edges of the inner triangle we're going to fill it with white.

```javascript
class Triangle {
  draw (ctx, color, steps, stepSize, lineWidth) {

    // Draw triangle outline

    ctx.beginPath();
    ctx.moveTo(this.a.x, this.a.y)
    ctx.lineTo(this.b.x, this.b.y)
    ctx.lineTo(this.c.x, this.c.y)
    ctx.lineTo(this.a.x, this.a.y)
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();

    // Draw inner lines

    var height = Math.sqrt(Math.pow(this.height, 2)) - this.height / 2
    var d = new Point((this.b.x + this.c.x) / 2, (this.b.y + this.c.y) / 2)

    ctx.strokeStyle = 'white'
    ctx.lineWidth = lineWidth

    for (var i = 1; i <= steps; i++) {
      var r = (stepSize * i) / height
      var p = new Point(
        this.a.x + (d.x - this.a.x) * r,
        this.a.y + (d.y - this.a.y) * r,
      )
      var innerTriangle = newTriangle(p, this.angle, this.height - r * this.height)
      ctx.beginPath();
      ctx.moveTo(innerTriangle.a.x, innerTriangle.a.y)
      ctx.lineTo(innerTriangle.b.x, innerTriangle.b.y)
      ctx.moveTo(innerTriangle.a.x, innerTriangle.a.y)
      ctx.lineTo(innerTriangle.c.x, innerTriangle.c.y)
      ctx.stroke();
      ctx.closePath();
    }

    // Draw white hollow part

    var r = (stepSize * steps) / height
    var c = new Point(
      this.a.x + (d.x - this.a.x) * r,
      this.a.y + (d.y - this.a.y) * r,
    )
    var innerTriangle = newTriangle(c, this.angle, this.height - r * this.height)
    ctx.beginPath();
    ctx.moveTo(innerTriangle.a.x, innerTriangle.a.y)
    ctx.lineTo(innerTriangle.b.x, innerTriangle.b.y)
    ctx.lineTo(innerTriangle.c.x, innerTriangle.c.y)
    ctx.lineTo(innerTriangle.a.x, innerTriangle.a.y)
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.closePath();
  }
}

newTriangle(new Point(200, 500), -30, 500).draw(ctx, '#336699', 8, 20, 3)
```

![6](/img/blog/stella-triangles/6.png)

That's it! Now we can use the `newTriangle` method and make a composition. Let's try and reproduce the two compositions that I showed at the beginning of this post.

```javascript
newTriangle(new Point(320, 500), -90, 500).draw(ctx, '#503f74', 8, 20, 3)
newTriangle(new Point(320, 500), -30, 500).draw(ctx, '#ad546e', 8, 20, 3)
```

![7](/img/blog/stella-triangles/7.png)

```javascript
newTriangle(new Point(450, 100), -210, 400).draw(ctx, '#36738a', 8, 15, 3)
newTriangle(new Point(450, 100), -270, 400).draw(ctx, '#46736c', 8, 15, 3)
newTriangle(new Point(450, 100), -330, 400).draw(ctx, '#483e59', 8, 15, 3)
```

![8](/img/blog/stella-triangles/8.png)

I think this is pretty cool, especially considering the fact that the code is quite terse and straightforward. You do however have to do a bit of mental gymnastic to get the angle stuff figured out but it's not too difficult. Of course all credit goes to Frank Stella; I'm just a coder.

As usual all the code is available on [GitHub](https://github.com/MaxHalford/procedural-art/blob/master/4_stella_triangles.html).
