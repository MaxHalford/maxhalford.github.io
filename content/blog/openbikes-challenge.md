+++
date = "2017-01-26"
draft = false
title = "A short introduction and conclusion to the OpenBikes 2016 Challenge"
+++

During my undergraduate internship in 2015 I started a side project called OpenBikes. The idea was to visualize and analyze bike sharing over multiple cities. [Axel Bellec](http://axelbellec.fr/) joined me and in 2016 we [won a national open data competition](http://www.opendatafrance.net/2016/02/05/le-prix-open-data-toulouse-metropole-remis-a-openbikes). Since then we haven't pursued anything major, instead we use OpenBikes to try out technologies and to apply concepts we learn at university and on online.

Before the 2016 summer holidays one of my professors, [Aurélien Garivier](https://www.math.univ-toulouse.fr/~agarivie/), mentioned that he was considering using our data for a Kaggle-like competition between some statistics curriculums in France. Near the end of the summer I sat down with a group of professors and we decided upon a format for the so-called "Challenge". The general idea was to provide student teams with historical data on multiple bike stations and ask to do some forecasting which we would then score based on a secret truth. The whole thing lasted from the 5th of October 2016 till the 26th of January 2017 when the best team was crowned.

The challenge was split into two phases. During the first phase, the teams were provided with data spanning from the 1st of April until the 5th of October at 10 AM. The data contained updates on the number of bikes at each station, the geographical position of the stations and the weather in each city. They were asked to forecast the number of bikes at 30 stations for 10 fixed timesteps ranging from the 5th of October at 10 AM until the 9th of October. We picked 10 stations from Toulouse, Lyon and Paris. Each team had access to an account page where they could deposit their submission which were then automatically scored. A public leaderboard was available at the homepage of the website Axel and I built.

During the second part of the challenge, which lasted from the 12th of January 2017 until the 20th of January 2017, the teams were provided with a new dataset containing similar data than the first part, except that Lyon has been swapped out for New-York. The data went from the 1st of April 2016 until the 11th of January 2017. The timesteps to predict were the same - both test sets went from a Wednesday till a Sunday. The teams did not get any feedback when they made a submission during the second part, they were scored based on their last submission, *à l'aveugle*.

In each part of the challenge the chosen metric to score the students was the [mean absolute error](https://www.wikiwand.com/en/Mean_absolute_error) between their submissions and the truth. The use of the MAE makes it possible to say things such as "team A was, on average, 3.2 bikes off target".


## Technical notes

Axel and I had been collecting freely available bike sharing data since October 2015. To do this we put in a place a homemade crawler which would interrogate various APIs and aggregate their data into a single format. We stored the number of bikes at each station at different timesteps with MongoDB. The metadata concerning the of the cities and the bike stations was stored with PostgreSQL. We also exposed an API to be able to use our data in an hypothetical mobile app. We deployed our crawler/API on a 20$ DigitalOcean server. The glue language was Python. [The whole thing is available on GitHub](https://github.com/OpenBikes/api.openbikes.co).

To host the challenge I wrote a simple Django application (my first time!) which Axel kindly deployed on the same server as the crawler. The application used a SQLite as a database backend, partly because I wanted to try it out in production but because anything more powerful was unnecessary. Moreover SQLite stores it's data in `*.db` file which can easily be transfered for doing some descriptive statistics. Again, [the code is available on GitHub](https://github.com/OpenBikes/challenge.openbikes.co).


## Results

The turnout was quite high considering the fact that we didn't put that much effort into the matter. All in all 8 curriculums and 50 teams took part in the challenge. A total of 947 valid submissions were made, which makes an average of 19 submissions per teams and 7 submissions a day - our server could easily handle that! Of course the rate at which teams submitted wasn't uniform through time, as can be seen on the following chart.

<div align="center">
<figure>
    <img src="/img/blog/openbikes-challenge/submissions_per_day.png" alt="submissions_per_day">
    <figcaption>New Year resolutions seem to have kicked in</figcaption>
</figure>
</div>

[Philippe Besse](https://www.math.univ-toulouse.fr/~besse/) suggested looking into the relationship between the number of submissions and the best score per team. The idea was to see if any overfitting had occured, in other words that the best scores were obtained by making many submissions with small adjustments. As can be seen on the following chart, an expected phenomenon arises: teams that have the best scores are usually the ones that have submitted more than others. Interestingly this becomes less obvious the more the teams submit, which basically means that getting a better score becomes harder and harder - this is always the case in data science competitions. To illustrate this phenomenon I fitted an exponential curve to the data.

<div align="center">
<figure>
    <img src="/img/blog/openbikes-challenge/score_vs_submissions.png" alt="score_vs_submissions">
    <figcaption>An exponential trend can vaguely be seen</figcaption>
</figure>
</div>

The final public leaderboard (for the first part that is) was the following.

<div>
<style type="text/css">
.tg  {border-collapse:collapse;border-spacing:0;border-color:#ccc;border-width:1px;border-style:solid;}
.tg td{font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:0px;overflow:hidden;word-break:normal;border-color:#ccc;color:#333;background-color:#fff;}
.tg th{font-family:Arial, sans-serif;font-size:14px;font-weight:normal;padding:10px 5px;border-style:solid;border-width:0px;overflow:hidden;word-break:normal;border-color:#ccc;color:#333;background-color:#f0f0f0;}
.tg .tg-9hbo{font-weight:bold;vertical-align:top}
.tg .tg-b7b8{background-color:#f9f9f9;vertical-align:top}
.tg .tg-yw4l{vertical-align:top}
</style>
<table class="tg">
  <tr>
    <th class="tg-9hbo">Team name</th>
    <th class="tg-9hbo">Curriculum</th>
    <th class="tg-9hbo">Best score</th>
    <th class="tg-9hbo">Number of submissions</th>
  </tr>
  <tr>
    <td class="tg-b7b8">Dream Team</td>
    <td class="tg-b7b8">ISAE - SUPAERO</td>
    <td class="tg-b7b8">2.7944230769230773</td>
    <td class="tg-b7b8">49</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Mr Nobody</td>
    <td class="tg-yw4l">Université de Bordeaux</td>
    <td class="tg-yw4l">3.49</td>
    <td class="tg-yw4l">14</td>
  </tr>
  <tr>
    <td class="tg-b7b8">Oh l'équipe</td>
    <td class="tg-b7b8">Université de Bordeaux</td>
    <td class="tg-b7b8">3.49</td>
    <td class="tg-b7b8">45</td>
  </tr>
  <tr>
    <td class="tg-yw4l">PrédiX</td>
    <td class="tg-yw4l">Ecole Polytechnique</td>
    <td class="tg-yw4l">3.5402333333332323</td>
    <td class="tg-yw4l">47</td>
  </tr>
  <tr>
    <td class="tg-b7b8">Louison Bobet</td>
    <td class="tg-b7b8">StatEco - Toulouse School of Economics</td>
    <td class="tg-b7b8">3.61</td>
    <td class="tg-b7b8">61</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Armstrong</td>
    <td class="tg-yw4l">GMM - INSA</td>
    <td class="tg-yw4l">3.62</td>
    <td class="tg-yw4l">35</td>
  </tr>
  <tr>
    <td class="tg-b7b8">OpenBikes</td>
    <td class="tg-b7b8">CMISID - Université Paul Sabatier</td>
    <td class="tg-b7b8">3.62930918737076</td>
    <td class="tg-b7b8">7</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Ravenclaw</td>
    <td class="tg-yw4l">Université de Bordeaux</td>
    <td class="tg-yw4l">3.67</td>
    <td class="tg-yw4l">64</td>
  </tr>
  <tr>
    <td class="tg-b7b8">LA ROUE ARRIÈRE</td>
    <td class="tg-b7b8">CMISID - Université Paul Sabatier</td>
    <td class="tg-b7b8">3.679264355300685</td>
    <td class="tg-b7b8">6</td>
  </tr>
  <tr>
    <td class="tg-yw4l">WeLoveTheHail</td>
    <td class="tg-yw4l">GMM - INSA</td>
    <td class="tg-yw4l">3.703333333333333</td>
    <td class="tg-yw4l">5</td>
  </tr>
  <tr>
    <td class="tg-b7b8">GMMerckx</td>
    <td class="tg-b7b8">GMM - INSA</td>
    <td class="tg-b7b8">3.7266666666666666</td>
    <td class="tg-b7b8">20</td>
  </tr>
  <tr>
    <td class="tg-yw4l">TEAM_SKY</td>
    <td class="tg-yw4l">Université de Bordeaux</td>
    <td class="tg-yw4l">3.7333333333333334</td>
    <td class="tg-yw4l">17</td>
  </tr>
  <tr>
    <td class="tg-b7b8">zoomzoom</td>
    <td class="tg-b7b8">Université de Bordeaux</td>
    <td class="tg-b7b8">3.7333333333333334</td>
    <td class="tg-b7b8">21</td>
  </tr>
  <tr>
    <td class="tg-yw4l">KAMEHAMEHA</td>
    <td class="tg-yw4l">Université de Bordeaux</td>
    <td class="tg-yw4l">3.7333333333333334</td>
    <td class="tg-yw4l">21</td>
  </tr>
  <tr>
    <td class="tg-b7b8">Tricycles</td>
    <td class="tg-b7b8">GMM - INSA</td>
    <td class="tg-b7b8">3.743333333333333</td>
    <td class="tg-b7b8">102</td>
  </tr>
  <tr>
    <td class="tg-yw4l">AfricanCommunity</td>
    <td class="tg-yw4l">CMISID - Université Paul Sabatier</td>
    <td class="tg-yw4l">3.7480411895507957</td>
    <td class="tg-yw4l">45</td>
  </tr>
  <tr>
    <td class="tg-b7b8">Avermaert</td>
    <td class="tg-b7b8">Université de Bordeaux</td>
    <td class="tg-b7b8">3.75</td>
    <td class="tg-b7b8">21</td>
  </tr>
  <tr>
    <td class="tg-yw4l">ZiZou98 &lt;3</td>
    <td class="tg-yw4l">GMM - INSA</td>
    <td class="tg-yw4l">3.776666666666667</td>
    <td class="tg-yw4l">54</td>
  </tr>
  <tr>
    <td class="tg-b7b8">LesCyclosTouristes</td>
    <td class="tg-b7b8">CMISID - Université Paul Sabatier</td>
    <td class="tg-b7b8">3.8066666666666666</td>
    <td class="tg-b7b8">33</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Ul-Team</td>
    <td class="tg-yw4l">Université de Bordeaux</td>
    <td class="tg-yw4l">3.8619785774274002</td>
    <td class="tg-yw4l">6</td>
  </tr>
  <tr>
    <td class="tg-b7b8">Les Grosses Données</td>
    <td class="tg-b7b8">MAPI3 - Université Paul Sabatier</td>
    <td class="tg-b7b8">3.866305333958716</td>
    <td class="tg-b7b8">6</td>
  </tr>
  <tr>
    <td class="tg-yw4l">H2O</td>
    <td class="tg-yw4l">GMM - INSA</td>
    <td class="tg-yw4l">3.8833333333333333</td>
    <td class="tg-yw4l">14</td>
  </tr>
  <tr>
    <td class="tg-b7b8">RYJA Team</td>
    <td class="tg-b7b8">CMISID - Université Paul Sabatier</td>
    <td class="tg-b7b8">3.9366666666666665</td>
    <td class="tg-b7b8">3</td>
  </tr>
  <tr>
    <td class="tg-yw4l">NSS</td>
    <td class="tg-yw4l">Université de Bordeaux</td>
    <td class="tg-yw4l">3.9476790826017845</td>
    <td class="tg-yw4l">8</td>
  </tr>
  <tr>
    <td class="tg-b7b8">Pas le temps de niaiser</td>
    <td class="tg-b7b8">CMISID - Université Paul Sabatier</td>
    <td class="tg-b7b8">3.9486790826017866</td>
    <td class="tg-b7b8">1</td>
  </tr>
  <tr>
    <td class="tg-yw4l">TheCrazyInsaneFlyingMonkeySpaceInvaders</td>
    <td class="tg-yw4l">StatEco - Toulouse School of Economics</td>
    <td class="tg-yw4l">4.003399297813541</td>
    <td class="tg-yw4l">14</td>
  </tr>
  <tr>
    <td class="tg-b7b8">Jul saint-Jean-la-Puenta</td>
    <td class="tg-b7b8">StatEco - Toulouse School of Economics</td>
    <td class="tg-b7b8">4.003399297813541</td>
    <td class="tg-b7b8">13</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Four and one</td>
    <td class="tg-yw4l">StatEco - Toulouse School of Economics</td>
    <td class="tg-yw4l">4.04</td>
    <td class="tg-yw4l">24</td>
  </tr>
  <tr>
    <td class="tg-b7b8">test</td>
    <td class="tg-b7b8">CMISID - Université Paul Sabatier</td>
    <td class="tg-b7b8">4.088626133087001</td>
    <td class="tg-b7b8">38</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Pedalo</td>
    <td class="tg-yw4l">GMM - INSA</td>
    <td class="tg-yw4l">4.088626133087581</td>
    <td class="tg-yw4l">1</td>
  </tr>
  <tr>
    <td class="tg-b7b8">alela</td>
    <td class="tg-b7b8">Université de Bordeaux</td>
    <td class="tg-b7b8">4.173333333333333</td>
    <td class="tg-b7b8">2</td>
  </tr>
  <tr>
    <td class="tg-yw4l">MoAx</td>
    <td class="tg-yw4l">GMM - INSA</td>
    <td class="tg-yw4l">4.199905182463245</td>
    <td class="tg-yw4l">20</td>
  </tr>
  <tr>
    <td class="tg-b7b8">Pas de Pau</td>
    <td class="tg-b7b8">Université de Pau</td>
    <td class="tg-b7b8">4.25912069022148</td>
    <td class="tg-b7b8">2</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Le Gruppetto</td>
    <td class="tg-yw4l">StatEco - Toulouse School of Economics</td>
    <td class="tg-yw4l">4.333333333333333</td>
    <td class="tg-yw4l">8</td>
  </tr>
  <tr>
    <td class="tg-b7b8">Lolilol</td>
    <td class="tg-b7b8">Université de Bordeaux</td>
    <td class="tg-b7b8">4.338140757878622</td>
    <td class="tg-b7b8">1</td>
  </tr>
  <tr>
    <td class="tg-yw4l">DataScientist2017</td>
    <td class="tg-yw4l">StatEco - Toulouse School of Economics</td>
    <td class="tg-yw4l">5.003333333333333</td>
    <td class="tg-yw4l">11</td>
  </tr>
  <tr>
    <td class="tg-b7b8">SRAM</td>
    <td class="tg-b7b8">MAPI3 - Université Paul Sabatier</td>
    <td class="tg-b7b8">5.10472813815054</td>
    <td class="tg-b7b8">1</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Outliers</td>
    <td class="tg-yw4l">MAPI3 - Université Paul Sabatier</td>
    <td class="tg-yw4l">5.3133333333333335</td>
    <td class="tg-yw4l">28</td>
  </tr>
  <tr>
    <td class="tg-b7b8">Jean Didier Vélo ♯♯</td>
    <td class="tg-b7b8">MAPI3 - Université Paul Sabatier</td>
    <td class="tg-b7b8">5.3133333333333335</td>
    <td class="tg-b7b8">5</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Velouse</td>
    <td class="tg-yw4l">CMISID - Université Paul Sabatier</td>
    <td class="tg-yw4l">5.343147845575032</td>
    <td class="tg-yw4l">12</td>
  </tr>
  <tr>
    <td class="tg-b7b8">TEAM NNBJ</td>
    <td class="tg-b7b8">CMISID - Université Paul Sabatier</td>
    <td class="tg-b7b8">5.343147845575032</td>
    <td class="tg-b7b8">1</td>
  </tr>
  <tr>
    <td class="tg-yw4l"></td>
    <td class="tg-yw4l">MAPI3 - Université Paul Sabatier</td>
    <td class="tg-yw4l">5.49</td>
    <td class="tg-yw4l">5</td>
  </tr>
  <tr>
    <td class="tg-b7b8">JMEG</td>
    <td class="tg-b7b8">MAPI3 - Université Paul Sabatier</td>
    <td class="tg-b7b8">5.783141628450403</td>
    <td class="tg-b7b8">7</td>
  </tr>
  <tr>
    <td class="tg-yw4l">player</td>
    <td class="tg-yw4l">CMISID - Université Paul Sabatier</td>
    <td class="tg-yw4l">6.3133333333333335</td>
    <td class="tg-yw4l">21</td>
  </tr>
  <tr>
    <td class="tg-b7b8">TSE-BigData</td>
    <td class="tg-b7b8">StatEco - Toulouse School of Economics</td>
    <td class="tg-b7b8">6.536927792628606</td>
    <td class="tg-b7b8">5</td>
  </tr>
  <tr>
    <td class="tg-yw4l">kangou</td>
    <td class="tg-yw4l">Université de Bordeaux</td>
    <td class="tg-yw4l">6.826666666666667</td>
    <td class="tg-yw4l">16</td>
  </tr>
  <tr>
    <td class="tg-b7b8">On aura votre Pau Supaéro</td>
    <td class="tg-b7b8">Université de Pau</td>
    <td class="tg-b7b8">7.306310702178721</td>
    <td class="tg-b7b8">1</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Les Pédales</td>
    <td class="tg-yw4l">StatEco - Toulouse School of Economics</td>
    <td class="tg-yw4l">7.803333333333334</td>
    <td class="tg-yw4l">1</td>
  </tr>
  <tr>
    <td class="tg-b7b8">BIKES FINDERS</td>
    <td class="tg-b7b8">StatEco - Toulouse School of Economics</td>
    <td class="tg-b7b8">8.07</td>
    <td class="tg-b7b8">1</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Université Bordeaux Enseignants</td>
    <td class="tg-yw4l">ISAE - SUPAERO</td>
    <td class="tg-yw4l">8.59</td>
    <td class="tg-yw4l">3</td>
  </tr>
  <tr>
    <td class="tg-b7b8">Pedalo</td>
    <td class="tg-b7b8">GMM - INSA</td>
    <td class="tg-b7b8">8.876666666666667</td>
    <td class="tg-b7b8">1</td>
  </tr>
</table>
</div>

Congratulations to team "Dream Team" for winning, by far, the first part of the challenge. The rest of best teams seem to have hit a wall at ~3.6 bikes. This can be seen on the following chart which shows the best score of the 10 best teams along time.

<div align="center">
<figure>
    <img src="/img/blog/openbikes-challenge/top_10_progression.png" alt="top_10_progression">
    <figcaption>Dream Team went from 4 to 2.7 all of a sudden</figcaption>
</figure>
</div>

As for the ranking for the second part of the challenge (the blindfolded part), here is the final ranking:

<div>
<style type="text/css">
.tg  {border-collapse:collapse;border-spacing:0;border-color:#ccc;}
.tg td{font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:0px;overflow:hidden;word-break:normal;border-color:#ccc;color:#333;background-color:#fff;border-top-width:1px;border-bottom-width:1px;}
.tg th{font-family:Arial, sans-serif;font-size:14px;font-weight:normal;padding:10px 5px;border-style:solid;border-width:0px;overflow:hidden;word-break:normal;border-color:#ccc;color:#333;background-color:#f0f0f0;border-top-width:1px;border-bottom-width:1px;}
.tg .tg-9hbo{font-weight:bold;vertical-align:top}
.tg .tg-yw4l{vertical-align:top}
</style>
<table class="tg">
  <tr>
    <th class="tg-9hbo">Team name</th>
    <th class="tg-9hbo">Curriculum</th>
    <th class="tg-9hbo">Best score</th>
  </tr>
  <tr>
    <td class="tg-yw4l">Le Gruppetto</td>
    <td class="tg-yw4l">StatEco - Toulouse School of Economics</td>
    <td class="tg-yw4l">3.2229284855662748</td>
  </tr>
  <tr>
    <td class="tg-yw4l">OpenBikes</td>
    <td class="tg-yw4l">CMISID - Université Paul Sabatier</td>
    <td class="tg-yw4l">3.73651042834827</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Louison Bobet</td>
    <td class="tg-yw4l">StatEco - Toulouse School of Economics</td>
    <td class="tg-yw4l">3.816666666666667</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Mr Nobody</td>
    <td class="tg-yw4l">Université de Bordeaux</td>
    <td class="tg-yw4l">3.94</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Oh l'équipe</td>
    <td class="tg-yw4l">Université de Bordeaux</td>
    <td class="tg-yw4l">3.953333333333333</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Ravenclaw</td>
    <td class="tg-yw4l">Université de Bordeaux</td>
    <td class="tg-yw4l">4.05</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Tricycles</td>
    <td class="tg-yw4l">GMM - INSA</td>
    <td class="tg-yw4l">4.24</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Four and one</td>
    <td class="tg-yw4l">StatEco - Toulouse School of Economics</td>
    <td class="tg-yw4l">4.45</td>
  </tr>
  <tr>
    <td class="tg-yw4l">PrédiX</td>
    <td class="tg-yw4l">Ecole Polytechnique</td>
    <td class="tg-yw4l">4.523916666666766</td>
  </tr>
  <tr>
    <td class="tg-yw4l">WeLoveTheHail</td>
    <td class="tg-yw4l">GMM - INSA</td>
    <td class="tg-yw4l">4.596666666666667</td>
  </tr>
  <tr>
    <td class="tg-yw4l">ZiZou98 &lt;3</td>
    <td class="tg-yw4l"></td>
    <td class="tg-yw4l">4.596666666666667</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Dream Team</td>
    <td class="tg-yw4l">ISAE - SUPAERO</td>
    <td class="tg-yw4l">4.6402666666666725</td>
  </tr>
  <tr>
    <td class="tg-yw4l">GMMerckx</td>
    <td class="tg-yw4l">GMM - INSA</td>
    <td class="tg-yw4l">4.706091376666668</td>
  </tr>
  <tr>
    <td class="tg-yw4l">LA ROUE ARRIÈRE</td>
    <td class="tg-yw4l">CMISID - Université Paul Sabatier</td>
    <td class="tg-yw4l">4.711600488605138</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Avermaert</td>
    <td class="tg-yw4l">Université de Bordeaux</td>
    <td class="tg-yw4l">4.74</td>
  </tr>
  <tr>
    <td class="tg-yw4l">TSE-BigData</td>
    <td class="tg-yw4l">StatEco - Toulouse School of Economics</td>
    <td class="tg-yw4l">4.754570707888592</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Pedalo</td>
    <td class="tg-yw4l">GMM - INSA</td>
    <td class="tg-yw4l">4.755557911517161</td>
  </tr>
  <tr>
    <td class="tg-yw4l">test</td>
    <td class="tg-yw4l">CMISID - Université Paul Sabatier</td>
    <td class="tg-yw4l">4.755557911517161</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Armstrong</td>
    <td class="tg-yw4l">GMM - INSA</td>
    <td class="tg-yw4l">4.87</td>
  </tr>
  <tr>
    <td class="tg-yw4l">H2O</td>
    <td class="tg-yw4l">GMM - INSA</td>
    <td class="tg-yw4l">4.93</td>
  </tr>
  <tr>
    <td class="tg-yw4l">LesCyclosTouristes</td>
    <td class="tg-yw4l">CMISID - Université Paul Sabatier</td>
    <td class="tg-yw4l">4.963333333333333</td>
  </tr>
  <tr>
    <td class="tg-yw4l">AfricanCommunity</td>
    <td class="tg-yw4l">CMISID - Université Paul Sabatier</td>
    <td class="tg-yw4l">4.977632664232967</td>
  </tr>
  <tr>
    <td class="tg-yw4l">TheCrazyInsaneFlyingMonkeySpaceInvaders</td>
    <td class="tg-yw4l">StatEco - Toulouse School of Economics</td>
    <td class="tg-yw4l">5.092628340778687</td>
  </tr>
  <tr>
    <td class="tg-yw4l">NSS</td>
    <td class="tg-yw4l">Université de Bordeaux</td>
    <td class="tg-yw4l">5.2957133684308015</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Ul-Team</td>
    <td class="tg-yw4l">Université de Bordeaux</td>
    <td class="tg-yw4l">5.374689402650746</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Les Pédales</td>
    <td class="tg-yw4l">StatEco - Toulouse School of Economics</td>
    <td class="tg-yw4l">5.492804691024131</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Les Grosses Données</td>
    <td class="tg-yw4l">MAPI3 - Université Paul Sabatier</td>
    <td class="tg-yw4l">5.62947781887139</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Velouse</td>
    <td class="tg-yw4l">CMISID - Université Paul Sabatier</td>
    <td class="tg-yw4l">5.666666666666668</td>
  </tr>
  <tr>
    <td class="tg-yw4l">DataScientist2017</td>
    <td class="tg-yw4l">StatEco - Toulouse School of Economics</td>
    <td class="tg-yw4l">5.756666666666668</td>
  </tr>
  <tr>
    <td class="tg-yw4l">JMEG</td>
    <td class="tg-yw4l">MAPI3 - Université Paul Sabatier</td>
    <td class="tg-yw4l">5.981138200799902</td>
  </tr>
  <tr>
    <td class="tg-yw4l">RYJA Team</td>
    <td class="tg-yw4l">CMISID - Université Paul Sabatier</td>
    <td class="tg-yw4l">6.026666666666666</td>
  </tr>
  <tr>
    <td class="tg-yw4l">BIKES FINDERS</td>
    <td class="tg-yw4l">StatEco - Toulouse School of Economics</td>
    <td class="tg-yw4l">6.076666666666667</td>
  </tr>
  <tr>
    <td class="tg-yw4l">TEAM_SKY</td>
    <td class="tg-yw4l">Université de Bordeaux</td>
    <td class="tg-yw4l">6.123333333333332</td>
  </tr>
  <tr>
    <td class="tg-yw4l">KAMEHAMEHA</td>
    <td class="tg-yw4l">Université de Bordeaux</td>
    <td class="tg-yw4l">6.123333333333332</td>
  </tr>
  <tr>
    <td class="tg-yw4l">zoomzoom</td>
    <td class="tg-yw4l">Université de Bordeaux</td>
    <td class="tg-yw4l">6.123333333333332</td>
  </tr>
  <tr>
    <td class="tg-yw4l"></td>
    <td class="tg-yw4l">MAPI3 - Université Paul Sabatier</td>
    <td class="tg-yw4l">6.246666666666667</td>
  </tr>
  <tr>
    <td class="tg-yw4l">Outliers</td>
    <td class="tg-yw4l">MAPI3 - Université Paul Sabatier</td>
    <td class="tg-yw4l">7.926666666666668</td>
  </tr>
  <tr>
    <td class="tg-yw4l">TEAM NNBJ</td>
    <td class="tg-yw4l">CMISID - Université Paul Sabatier</td>
    <td class="tg-yw4l">8.243333333333334</td>
  </tr>
  <tr>
    <td class="tg-yw4l">MoAx</td>
    <td class="tg-yw4l">GMM - INSA</td>
    <td class="tg-yw4l">10.946772841269727</td>
  </tr>
</table>
</div>

Team "Le Gruppetto" is officially the winner of the challenge! "The Rabbit and the Turtle" anyone? The fact that the second was blindfolded completely reversed the rankings and favored teams with robust methods whilst penalizing overfitters. Whatsmore "only" 39 teams took part in the second part (50 did in the first one); maybe some teams felt that their ranking wouldn't change, but the fact is that "Le Gruppetto" were 34th before being 1st. *It ain't over till the fat lady sings*. The following chart shows the best score per team for both parts of the challenge.

<div align="center">
<figure>
    <img src="/img/blog/openbikes-challenge/part1_vs_part2_scores.png" alt="part1_vs_part2_scores">
    <figcaption>I'm the orange spot overlapped by a cyan one in the bottom left!</figcaption>
</figure>
</div>


## Who used what?

Every team was asked to submit their code for the second submission. Mostly this was required to make sure no team had cheated by retrieving the data from an API, however this was also the occasion to see what tools the students were using. Here is a brief summary:

- 23 teams used R (mostly xgboost, dplyr, gbm, randomForest, caret)
- 19 teams used random forests
- 15 teams used Python (mostly pandas and sklearn)
- 8 teams used some form of averaging (which isn't really machine learning), 5 went further and used the averages as features
- 7 teams used gradient boosted trees
- 4 teams used [Jupyter](http://jupyter.org/) with Python
- 3 teams used model stacking (they averaged the outputs of their individual models)
- 3 teams used vanilla linear regression
- 2 teams averaged the number of bikes in the surrounding stations
- 2 teams used randomized decision trees (they did fairly well)
- 2 teams used $$k$$ nearest neighbours
- 1 team used [RMarkdown](http://rmarkdown.rstudio.com/)
- 1 team used LASSO regression
- 1 team used a CART
- 1 team used a SARIMA process
- 1 team used a recurrent neural network (me!)
- 1 team used [dynamic time warping](https://www.wikiwand.com/en/Dynamic_time_warping)
- 1 team used principal component analysis

An interesting fact is that out of the 7 teams who used Python, 4 used it for preparing their data but coded their model in R.

The winners of first part used a random forest, dynamic time warping and principal component decomposition - their Python code is quite hard to grasp! As for the winners of the second part, they coded in R and looked at surrounding stations whilst using gradient boosted trees.

## Conclusion

I would like to thank all the students and teachers that participated from the following schools:

- [Université Paul Sabatier](http://www.univ-tlse3.fr/), 19 teams
- [Toulouse School of Economics](http://ecole.tse-fr.eu/fr), 13 teams
- [Université de Bordeaux](https://www.u-bordeaux.fr/), 13 teams
- [INSA Toulouse](http://www.insa-toulouse.fr/fr/index.html), 10 teams
- [ISAE - SUPAERO](https://www.isae-supaero.fr/), 2 teams
- [Université de Pau](http://www.univ-pau.fr/fr/index.html), 2 teams
- [Ecole Polytechnique (l'X)](http://www.polytechnique.edu/), 1 team

Personally I had a great experience organization wise. I had a few panic attacks whilst preparing the CSV files and updating the website, but generally everything went quite smoothly. As a participant my feelings were more mixed; to be totally honest I wasn't very inclined to participate. It's difficult to do in front and behind the stage!

## Datasets

I've made the datasets that were used during both parts of the challenge available - including the true answers - [click on this link to download them](https://www.dropbox.com/s/ic8m0b3mf5wxk4r/challenge.zip?dl=0).

Feel free to email me if you have any questions.
