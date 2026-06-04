+++
date = "2026-06-02"
title = "Lessons learned doing solution engineerng"
toc = true
tags = ['data-science']
+++

## Introduction

I joined [Carbonfact](https://www.carbonfact.com/) as a first employee. In a nutshell, it's software that takes in raw ERP and PLM data, and spits out environmental reports. I got pulled into many Sales processes and customer onboardings, in addition to building the software. As the company grew, so did my expertise, which made me relevant for selling to and managing big logos. We [signed](https://www.carbonfact.com/customers) a lot of well known brands in the fashion industry.

Nowadays I feel more or less comfortable interacting with customers. But I was awful at first. I know because one of the cofounders gave me harsh feedback after a call with our first serious customer. I still remember slamming the lid of my computer when we debriefed. What I perceived as harsh feedback at the time turned out to help me grow quickly.

I used to be a regular data scientist assigned to internal projects. Talking to prospects and customers got me out of my comfort zone. You owe them a service, and they expect you to deliver something. If something goes wrong they'll go above your head to your founders, at which you start feeling the heat. It can be quite harsh. But it can also be rewarding when things go well.

Every project is different, but there are tricks of the trade to pick up. I really like the Jim Donovan's [Secrets to Optimal Client Service](https://www.youtube.com/watch?v=hJbwyN4ZoCg) lecture. He gives out 11 pieces of advice:

```
1.  Never use jargon.
2.  Pause - slow yourself down.
3.  Look for opportunities to give the client advice that is not in your interest.
4.  Ask open ended questions.
5.  Be positive.
6.  Be careful about mixing business with socializing.
7.  Be humble.
8.  Be available - be responsive.
9.  Take a position - tell the client what to do.
10. Control the meeting.
11. Have an agenda, get the client to buy into it, and take notes.
```

I think this is an excellent starting point. Each piece of advice resonates with my experience. But Jim Donovan is a bigwig at Goldman Sachs, and I'm just a solution engineer at a small climate startup. I therefore wanted to write down my own advice, following the battle scars I earned.

There are three phases which I got to experience:

1. **Presales** — the customer is still a prospect. The goal is to get their signature. They are deeply in need of reassurance.
2. **Pilots** — the customer likes you, but they want you to prove you can walk the talk. They give themselves the right to leave with no strings attached.
3. **Onboardings** — the customer has picked you, but you need to onboard them into your solution for them to be fully reassured.

The goals at each phase are not the same. Also, the relationship you nurture with the customer changes when a contract is signed -- contracts will do that. Your attitude should also vary according to the level of trust going your way. Therefore, each phase has to be treated differently, and adaptibility is key.

## Presales

<div align="center" >
<figure style="width: 80%; margin: 0;">
    <img src="/img/blog/solution-engineering-advice/presales.png" style="box-shadow: none;">
</figure>
</div>

I didn't get any bonus when we signed a contract, so my livelihood didn't change whether or not we gained a new customer. That took a lot of the stress away from meeting prospects. But it didn't make me less motivated: I genuinely enjoyed partnering with the Sales team, and convincing prospects we were the right solution for them. I found it rewarding when we turned them into customers.

Regardless, presales is to me the less stressful phase. To make an analogy with relationships, it's like flirting. Everyone is on their best behavior and the conversation is very polite. This is because nobody owes each other anything -- yet. And even if the prospect ends up picking a different solution, there's always the option of them coming back to you down the road.

Presales is all about value perception and building trust. The people in front of you are desperate to pick the right solution. Picking the wrong one could cost them their job. Signing with you is a big deal to them. Having empathy for that goes a long way.

### Understand who's who

<div align="center" >
<figure style="width: 100%; margin: 0;">
    <img src="/img/blog/solution-engineering-advice/overview.png" style="box-shadow: none;">
</figure>
</div>

You'll normally partner with a member of your Sales team. This teammate is in charge of figuring out the lay of the land, by mapping the prospect's organization chart, and identifying the decision makers. If they're part of an organized team they'll follow a framework like [MEDDIC](https://sellingsherpa.com/index.php/2021/01/24/meddic-book-summary/). You don't need to concern yourself with this. Your focus should be on convincing the people your Sales buddy manages to put in front of you.

Your Sales buddy's incentive is financial. They want to sign the deal, almost at any cost. They appreciate having you with them, because you know more about the product than they do. But they are worried you don't have Sales instincts, and can screw the deal by being too honest.

What you should avoid is having your Sales buddy making an impossible promise. Promising something that doesn't exist yet but will/could happen, is different than promising something that you know will never happen in the years to come. The latter is lyeing, the former is overpromising. Lyeing can secure a short term deal, but everyone loses in the long run.

I perceived part of my job as being the link between the Sales and Tech teams. And I believe keeping that channel open matters a lot. The tech team will take the sales team seriously if they keep themselves honest. It's all about finding the right balance between what the current state of the product, what's in the pipe, what the customer wants, and what the Sales team wants to say. I think this is an important part of being a solution engineer.

There's usually some sort of project manager who oversees the process. This person initiated the decision to buy software. They're not C-level, but they might lead a (small) team, and have some internal leverage. This needs to become your champion. You won't manage to convince the rest of the company if you don't have a champion.

The champion is the easiest person you'll have to convince. Sadly they don't call the shots on their own. Your goal is to help your champion convince the decision makers at their company to choose you. The wedge is that your champion is on your side. They can help you understand what makes the decision makers tick, what needs to be emphasized, what question make come up, etc.

I've been in rare cases where your competition is your prospect: they are considering building instead of buying. In this case the champion might need be so much on your side. But it doesn't change much. The goal is still to explain the value of what you're doing.

### Get into a conversation

Your Sales buddy might bring you into a meeting to give a demo. Limiting yourself to the demo is the biggest mistake you can do. There's a good chance the demo won't wow the prospect. Especially if you're a startup and your product hasn't fully matured. Giving a demo is a big deal: you're opening the hood and showing the customer the software they're going to buy. It's like giving them a test drive of a car while so far they've been enjoying the bodywork. The good impression you nurtured so far can go south in the space of one meeting.

In my opinion, the best thing you can do is to get into a conversation as soon as you can. Ideally, by asking open-ended questions, the customer can hint at what they're worried about. You should make the demo relevant to their pain points, and avoid showing (cool) features that aren't relevant to them. Also, by letting them talk, you make them feel important. People love to go on and moan about their work. You're here to listen, and to get on their good side.

As a technical person, you know a lot about the software you're selling. In fact, you're likely the most knowledgeable person in the room -- and if you're not, you need to upskill to become that person. Don't overprepare. The best meetings are those that turn into a conversation, where you have a reassuring answer for each question/concern the prospect throws at you. You need to come off as knowledgeable, calm, confident. Bear in mind, the prospect is not just signing for software, they're also expecting to get professional services to help them use the software. This is your shot to give them a good impression.

Something I like to do is name-dropping, such as:

> *We worked with brand X, which you may know, and they use the same PLM software. Their data was heterogenous, but our system is designed for that situation.*

Another thing I occasionally do is to undersell the platform:

> *We implemented this feature a long time ago, it's a bit old. We've planning to revamp it soonish.*

In my opinion, the worst thing is demonstrating a feature and expecting the prospect to drewl at it. It won't happen so don't hope for it. Underplaying what you're showing is a subtle way to say "we have a high bar, we're just getting started". Of course, this depends on your audience. Some prospects need everything to be perfect right away, and aren't as trusting. For those you should limit yourself to a short demo on the most polished features, and move the meeting into a conversation. Read the room.

Again, your Sales buddy is nervous because compensation is at stake for them. They don't want you to mess up the deal by opening too many doors. That makes sense. You need to earn their trust before you can take the freedom of moving away from the script.

While it's beneficial to show off expertise, it's couterproductive to come off as a geek. The prospect won't sign for something they don't understand. You need to say smart things in a language they understand. And more importantly, you need to say things that solve their pain points. The prospect is here because they want to tackle something they can't with their internal resources. When you sense you're going too far into a topic, go back to the initial reasons why they're here.

### [Be economical with the truth](https://en.wikipedia.org/wiki/Economical_with_the_truth)

I've mostly worked in startup environments. I've never been at a place where the product is polished and signing a new customer is a well-oiled process. When you're at a startup, you feel you're punching above your weight when selling to enterprise customers.

You won't be rewarded for always telling the truth. That's not obvious when you come from a technical background. Personally, it took me some time to accept seeing one of my cofounders oversell who we were and what we were building to our prospects. But in a startup, especially in the enterprise SaaS category, faking it till you make it is necessary.

A good metaphor is that the tracks are being layed while the train is moving forward. You have to make the deal move forward -- that's the train -- but all the features the customer wants aren't ready yet -- the tracks. But if you trust yourself and your team to build those features eventually, then it's ok to be a bit mishonest with the customer. There's many situations where the customer will take your word for it and won't check themselves whether a feature exists.

The prospect has access to the platform you give them access to, and to you as a person. They don't know the vision for your company as well as you do, or what features are next in the pipe. It's up to you to share with them the vision for the company. It's totally ok to discuss big features are coming up. In fact this is a great way to get them excited to work with you.

## Pilots

<div align="center" >
<figure style="width: 80%; margin: 0;">
    <img src="/img/blog/solution-engineering-advice/pilot.png" style="box-shadow: none;">
</figure>
</div>

Pilots are the trickiest situations. The prospect has decided to move onwards, which is a sign they're interested in your product. But they are not convinced well enough to sign a full contract. You still have to earn their trust. To continue the dating analogy, this is the first time date is staying at your place. All the veneer you showed during dates can vanish if you're sloppy at home.

A key parameter is the duration of the pilot. You want enough time to fulfill what needs demonstrating. But you also don't want it to last too long. The more the pilots drags on, the more the prospect will turn over rocks you don't want them to. Also, the longer you wait to sign a deal, the likelier it is that the prospect's top management pulls the plug and calls the project off. That happens. If you have the choice, my advice is to keep it short and efficient.

In order to avoid fruitless pilots, be careful of not accepting impossible pilots. As a solution engineer, you don't have that kind of decision power, but nonetheless you should keep an eye on upcoming pilots in the pipe. Sometimes the Sales team accepts pilots too freely, when in fact a comprehensive demo with the customer's data can be enough. Pilots are not a piece of cake, so it's usually better if they can avoided in the first place.

### Clarify the success criteria

A pilot should kickoff with specifications for the project. These will initially come from the prospect: they are the ones with pain points to solve. However, you should not accept these specifications without reviewing them. Ideally, you should be able to rephrase them, and suggest new ones.

Some pilots succeed because you make such a good impression, that any prior doubt seem unfounded. It can go so well that people in the room will wonder why a pilot was needed in the first place. But you have to be prepared for the difficult scenario. Some prospects need to justify internally why they're picking you, and they have to back that up with something solid. This can be a list of business and technical criteria that you have to tick.

Your goal early on in -- and prior to -- the pilot is to remove all ambiguity. Whether the prospect likes you or not won't be relevant when they make the final call. The decision will be made based on the amount of criteria you were able to tick during the pilot.

Simply put, each criteria should be measurable. You and the prospect have to be able to determine, without ambiguity, whether a criteria is ticked or not. That may require rephrasing. For instance:

```diff
- Measure product environmental footprint
+ Measure GHG footprint for >95% of 2025 production volume
```

It's counter-intuitive, but splitting a criteria into many can be beneficial. Indeed several clear criteria are easier to tick off than one ambiguous criterion, for example:

```diff
- Provide modeling capabilities
+ Provide product level modeling via material country of origin swap
+ Provide company level modeling via material code swap
+ Provide company level modeling via supplier swap
```

Smaller customers may be keen on rephrasing success criteria. Many of them don't know exactly what they want, so they're open to suggestion. In other cases, the criteria might be more rigid. Especially in formal [RFPs](https://en.wikipedia.org/wiki/Request_for_proposal), where your pilot can be running in parallel of others, and the rules can't be modified. But even in those situations, I'd encourage you to provide your own interpretation of the criteria.

Iterating over the success criteria can take some time. It will require some back and forth, because each of your proposition can get a rebuttal from the prospect. But it is worth it. Running a pilot with clear success criteria is far less stressful for both parties.

### Control the tempo

You'll likely agree on a regular schedule to catchup with the prospect during the pilot. I've done this biweekly for six month pilots, but I find weekly works better if possible. The goal is to keep the prospect engaged. Especially towards the beginning of the pilot, where you rely on the prospect's technical team to get access to their data, clarify their mysterious business logic, etc.

You have to see the pilot as a race against time. The objective is to tick as many -- hopefully all -- success criteria before the end of the pilot. Many things can go wrong over the pilot's duration, and some of these you can't prepare for -- sickness, unannounced vacation, etc. But the main danger is to go offtrack. Surprisingly, the prospect's goal is not necessarily for you to succeed in time. Sure, they want you to tick the boxes, but they have no idea how long that can take, and whether the project is late or not. That's on you.

You have to prepare catchup meetings. You can't afford to be on the backfoot. The worst thing is to go into a meeting with the prospect without an agenda. It gives room for your prospect to bring their own agenda. They might have many questions that come up from using your software. These questions are probably relevant, but spending time on them can disserve you if you're late on delivering the pilot. So go over your own agenda before you let the prospect bring theirs up.

<div align="center" >
<figure style="width: 70%; margin: 0;">
    <img src="/img/blog/solution-engineering-advice/conductor.jpeg" style="box-shadow: none; margin: 0;">
</figure>
</div>

Controlling the tempo makes you look professional. You coming in the meeting with a clear list of talking points is reassuring for the prospect. It makes them feel they're in safe hands. Indeed, one of their biggest fears is to have to use your software without any support. They don't want to be alone.

You should be proactive. It's not nice when a customer spots a bug on their platform before you do. If you spot an issue in their data, then you should surface this. Proactively pointing out issues is a great way to come off as a trustworthy person.

I would say that prospects in pilot phases require more attention than regular customers. It's normal to hold a strong tempo. The flipside is that all this time you invest can go down the drain if the pilot is not a success, or whether the decision to buy gets recinded -- again, this happens. But that's the game.

### Make them perceive your value

An implicit goal of the pilot is to give the customer a good impression. Ticking off the success criteria is must have. Anything you can do to impress the prospect beyond their requirements can be beneficial.

You should let the customer know when you did something that took a lot of time. For instance, if you integrated some of their files, don't just tell them you did it. Tell them why it took time, what were the difficult parts, what your software streamlined etc. By putting emphasis on your work, the customer will perceive your value. The last thing you want is to make your work appear trivial, because in that case they'll be wondering what they're paying you for.

That being said, you shouldn't boast. Your goal is to get the prospect excited, by making them want to use your software. You don't need to impress them by explaining how you implemented a feature -- they don't care -- but should instead demonstrate how it will simplify their lives. The difference matters.

One trick here is to space out in time what you show them. If you've done many things this week, but you have nothing to show the week after, then balance things around. The prospect has a limited attention span, and there's a limit to the technical mumbo jumbo you can throw at them at once.

Other than the work you produce, try to enjoy what you're doing. Your prospect might eventually become a customer, so maintaining a healthy relationship is important. This goes both ways: the prospect will not pick a solution if the people that come with it are not nice to work with. Enthusiasm goes a long way in pilots.

## Onboardings

<div align="center" >
<figure style="width: 80%; margin: 0;">
    <img src="/img/blog/solution-engineering-advice/onboarding.png" style="box-shadow: none;">
</figure>
</div>

The prospect has decided to become a customer. They've signed a contract, which is usually binding for at least one year. Now comes the onboarding phase, where the goal is get them to be proficient with your software. An onboarding is similar to a pilot, in the sense that there's a lot of heavy lifting and teaching to perform. For instance parsing their messy data to ingest them in your tool. This *should* be less stressful than a pilot, because they've already signed a contract. However, onboarding will necessarily hinder the relationship.

The customer has formed an impression of what your software will do for them. This impression might have been sweetened by the person who sold them the software. And the software will probably meet their needs, but they first need to go through an onboarding phase for their usage to be smooth. Except if you've built an intuitive self-serve software, which was not the case at my company.

### Don't make it drag on

Onboardings demand an unusual time investment on your side. And the customer's patience will wear off the more it drags on. My advice is to compress the onboarding as much as possible. If you can afford to do at least one catchup meeting per week, then do it. It's usually more efficient to do the same amount of work in two months than it is to spread it over four months. It keeps the momentum going, and it leaves a good impression with the customer.

Be solution-oriented. Sometimes onboarding can feel like fitting a square peg in a round hole. Maybe the customer's data maturity is not there yet. Maybe they are missing some required data points. Maybe their data is there, but it's messy. The main reason you're is to work around these problems. It's easy to whine and put all the troubles on the customer's back.

You have to learn when to ask the customer, versus when to fix it yourself. This is an ability you acquire over time. Now when I see a new customer's IT point of contact, I'm able to perceive whether they're capable or not. If I ask them to fix something on their side, I need to trust them to follow through. If they don't, the project will be at risk, and you're the one who will be blamed. Trust the right people, and if there's nobody to trust then do it yourself.

In a healthy SaaS company, you'll review onboarding and deep dive into the ones that went overschedule. Again, it's easy to put the blame on the customer. But I don't think that's a productive way to improve. I believe that a good solution engineer is capable of adapting to the circumstances, by taking ownership. If something goes wrong, it's on you. Even if you're not a Navy SEAL, the concept of [Extreme Ownership](https://www.youtube.com/watch?v=ljqra3BcqWM) should resonate with you.

### Build a relationship

When possible, it's better to treat the customer as a partner. Personally, I'm not a fan of the usual balance of power that customers are used to. I don't want to be just another resource in their eyes. I always try to make them see me as a helpful partner, on an equal footing.

It's cheesy, but don't forget to have fun. Makes jokes. Onboardings can be stressful, but if no lives are at stake, then there's no reason for a tense atmosphere. You'll be working with this customer for years to come, if things go to plan. So be nice, do a good job, and eventually the customer will mellow.

Of course, this isn't something you can impose. Trust is something you obtain after putting in the hard work. Be humble at first, be more efficient than what the customer is used to, and eventually you will earn their respect. Sounds obvious, right?

> Love creates growth.

This is key. When you're a startup, the earlier stage are, the more prospects are reluctant to work with you because of your size. You're great and punching above your weight, but the prospect hasn't worked with you yet, so they have no strong reason to trust you. What they'll usually do is have a chat with one of your existing customers. This can make or break a deal. This is when you appreciate the worth of all the hours you poured into helping your customer.

### Involve your Product team

Some customers will be happily content with your software and get on with their lives. Some customers are more demanding, and expect your software to accomodate their every whim. When these customers are nice to work with, they can become design partners.

Adhoc work that doesn't fit into your product roadmap has to be avoided. That's not what you're here for, you're not a consultant. It's important to learn how to say no, and log customer demands into the product feedback pipe.

Your role is to be the person the customer likes and trusts. If something is wrong with your solution, and the customer is putting the blame on you, you should deflect to someone else in your organization. You should say "you're right, this part of the software is pretty bad, let me put you in touch with someone in our Product".

Some difficult customers just love being design partners. They thrive from bathing in the limelight and being heard by people. And it's a win-win situation: the Product feeds off customer feedback.

In some cases customer demands are impossible to fulfill and unreasonable in the first place. In order to not significantly degrade your relationship with them, you should put in touch with a "bad cop" at your company. This can be the Account Management team, which will explain that there demands do not fit in their contract -- hopefully your contracts are quite clear as to what your solution provides. Sometimes these situations escalate and involve founders/C-levels. This isn't a problem: as long as you're the good cop and someone else can play bad cop, you handled it well.

## Parting thoughts

I enjoyed being a solution engineering. It's a refreshing change from working on software in the background. I also sense being in front of customers turned me into a better data scientist. It's much easier now for me to put myselves into the customers' shoes, and see things the way they do, and perceiving what matters in the software I design.

These days, Forward Deployed Engineers and Product Engineers are well sought after, and each are [having their moment](https://www.linkedin.com/pulse/rise-forward-deployed-engineer-kelly-vaughn-xnmbe/). With the rise of AI, and the comoditization of writing software, your worth can increase by becoming a technical mind that can chat with customers.
