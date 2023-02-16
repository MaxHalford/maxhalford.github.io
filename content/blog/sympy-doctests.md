+++
date = "2023-02-15"
title = "Using SymPy in Python doctests"
tags = ['python']
+++

A program which compiles and runs without errors isn't necessarily correct. I find this to be especially true for statistical software, both as a developer and as a user. Small but nasty bugs creep up on me every week. I keep sane in the membrane by writing many unit tests 🐛🔨

I make heavy use of [doctests](https://docs.python.org/3/library/doctest.html). These are unit tests which you write as Python [docstrings](https://realpython.com/documenting-python-code/#documenting-your-python-code-base-using-docstrings). They're really handy because they kill two birds with one stone: the unit tests you write for a function also act as documentation.

A nice trick I've found is to use [SymPy](https://www.sympy.org/en/index.html) to test mathematical formulas. As you know, Python is a dynamic language. This allows functions to consume different types of inputs. The typical example are [NumPy](https://numpy.org/) routines, which work with numbers, lists, arrays, series, or a mix of these:

```py
>>> import numpy as np
>>> import pandas as pd

>>> np.add(17, 5)
22

>>> np.add([1, 2, 3], 22)
array([23, 24, 25])

>>> np.add(np.array([1, 2, 3]), pd.Series([22, 23, 24]))
0    23
1    25
2    27
dtype: int64

```

The above code block can be treated as a doctest. For instance, if you put it in a `test_add.py` file and place `"""` quotes around it, you can run `pytest` from the CLI to execute the tests, as so:

```sh
pytest --doctest-modules
```

```
================ test session starts =======================
platform darwin -- Python 3.11.0, pytest-7.2.0, pluggy-1.0.0
rootdir: /Users/max/projects/maxhalford.github.io
plugins: anyio-3.6.2
collected 1 item

test_add.py .                                         [100%]

================ 1 passed in 0.58s =========================
```

As I was saying, I like using SymPy to test mathematical functions. If a function uses mathematical operators, then there is a good chance you can feed it with SymPy variables as well as numbers and arrays.

I'll provide an example. A year ago, I added an online version of [ARIMA](https://www.wikiwand.com/en/Autoregressive_integrated_moving_average) to [River](https://riverml.xyz/0.14.0/). ARIMA is a time series forecasting model. Like other forecasting models, it assumes the time series is stationary. If it isn't, [differencing](https://www.wikiwand.com/en/Autoregressive_integrated_moving_average#Differencing) has to be applied.

The idea behind differencing is quite intuitive, but the implementation is easy to get wrong. I've included down below the `Differencer` class which is currently used in River.

<details>
  <summary>Click to see the <code>Differencer</code> class</summary>

```py
import collections
import itertools
import math

class Differencer:
    """A time series differencer.

    References
    ----------
    [^1]: [Stationarity and differencing](https://otexts.com/fpp2/stationarity.html)
    [^2]: [Backshift notation](https://otexts.com/fpp2/backshift.html)

    """

    def __init__(self, d, m=1):
        self.d = d
        self.m = m

        def n_choose_k(n, k):
            f = math.factorial
            return f(n) // f(k) // f(n - k)

        self.coeffs = {0: 1}
        for k in range(1, d + 1):
            t = k * m
            coeff = (-1 if k % 2 else 1) * n_choose_k(n=d, k=k)
            self.coeffs[t] = coeff

    @property
    def n_required_past_values(self):
        return max(self.coeffs)

    @classmethod
    def from_coeffs(cls, coeffs):
        obj = cls(0, 0)
        obj.coeffs = coeffs
        return obj

    def __mul__(self, other):
        """Compose two differencers together."""
        coeffs = collections.defaultdict(int)

        for (t1, c1), (t2, c2) in itertools.product(self.coeffs.items(), other.coeffs.items()):
            coeffs[t1 + t2] += c1 * c2

        # Remove 0 coefficients
        for t, c in list(coeffs.items()):
            if c == 0:
                del coeffs[t]

        return Differencer.from_coeffs(dict(coeffs))

    def diff(self, p, Y: list):
        """Differentiate by applying each coefficient c at each index t.

        Parameters
        ----------
        Y
            The window of previous values. The first element is assumed to be the most recent
            value.

        """
        total = 0
        for t, c in self.coeffs.items():
            try:
                total += (c * Y[t - 1]) if t else p
            except IndexError:
                break
        return total

    def undiff(self, p, Y: list):
        """Differentiate by applying each coefficient c at each index t.

        Parameters
        ----------
        Y
            The window of previous values. The first element is assumed to be the most recent
            value.

        """
        total = p
        for t, c in self.coeffs.items():
            try:
                if t:
                    total -= c * Y[t - 1]
            except IndexError:
                break
        return total
```
</details>

Here are some usage examples:

```py
>>> Differencer(1).diff(10, [7, 11, 12])
3

>>> Differencer(2).diff(10, [7, 11, 12])
7

>>> Differencer(1, 3).diff(10, [7, 11, 12])
-2

```

How do we know these doctests are correct? We could check with pen and paper. But that's not fully satisfying because we'd only be testing a limited range of inputs. Moreover, the above doctests don't really give any insight as to how the algorithm works, which is one of the selling points of doctests.

Let's write these unit tests with SymPy. The way it works is by defining symbols. I'll start with a $p$ symbol, which stands for the value which we want to differentiate.

```py
>>> import sympy
>>> p = sympy.symbols('p')
>>> p
p

```

Differentiating a value involves subtracting and adding past values $Y$ to the current value $p$. The last observed value is $Y_t$, while the penultimate one is $Y_{t-1}$. This goes all the way back to $Y_0$, which is the first value in the time series. To implement this variable which supports indexing, I made a little `IndexedSymbol` class with SymPy:

```py
class IndexedSymbol(sympy.IndexedBase):
    t = sympy.symbols("t", cls=sympy.Idx)

    def __getitem__(self, idx):
        return super().__getitem__(self.t - idx)
```

This variable can be accessed at any time `t` thanks to the `__getitem__` implementation:

```py
>>> Y = IndexedSymbol('Y')
>>> Y
Y

>>> Y[1]
Y[t - 1]

>>> y[2]
Y[t - 2]

```

Now we have everything we need to write pretty unit tests. The first case is a differencer which does nothing. Here I'll use [backshift notation](https://www.wikiwand.com/en/Lag_operator) to describe lag operations. I'll actually reproduce the [examples](https://otexts.com/fpp2/backshift.html) Rob J. Hyndman and George Athanasopoulos provide in their [*Forecasting: Principles and Practice*](https://otexts.com/fpp2/) textbook.

$$(1 - B)^0 = 1$$

```py
>>> Differencer(0).diff(p, Y)
p

```

As expected, the output is just $p$, because no differencing is applied. Note that the inputs are SymPy objects, and the output is also a SymPy object. In other words, we're writing tests with mathematical variables, and not just numbers. What about if we want to apply one level of differentiation?

$$(1 - B)^1$$

```py
>>> Differencer(1).diff(p, Y)
p - Y[t]

```

We see that this subtracts the last value to the current value, which is correct. What about a second level of differentiation?

$$(1 - B)^2$$

```py
>>> Differencer(2).diff(p, Y)
p + Y[t - 1] - 2*Y[t]

```

What about seasonal differencing? That is, we want to differentiate the current value with respect to the time series $m$ periods ago. For instance, with monthly data, it's typical to subtract the value 12 periods ago to the current value. The `Differencer` class has a `__mul__` method, which means we can multiply two `Differencer`s together to get a new one.

$$(1 - B)(1 - B^{12})$$

```py
>>> (Differencer(1) * Differencer(1, 12)).diff(p, Y)
p - Y[t - 11] + Y[t - 12] - Y[t]

```

This is cool because we can tell the output is correct, regardless of the actual values `Y` contains. If you test using numbers, then there is a chance the output is correct due to luck. In other words, your implementation might be correct for the values you test it with, but not for all possible values. Testing with SymPy variables takes this uncertainty away.
