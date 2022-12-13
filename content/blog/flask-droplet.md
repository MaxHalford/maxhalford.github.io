+++
date = "2015-07-14"
draft = false
title = "Setting up a droplet to host a Flask app"
tags = ['web-dev']
+++

After having worked for some weeks on the [OpenBikes website](http://openbikes.co), it was time to put it online. [Digital Ocean](https://www.digitalocean.com/) seemed to provide a good service and so I decided to give it a spin. Their documentation is quite good but it doesn't cover exactly everything for setting up Flask. In this post I simply want to record every single step I took.

OpenBikes is a project with a Flask backend and a few upstart jobs. It lives at the [openbikes.co](http://openbikes.co) domain name. In this blog post I will list every step it takes to make it happen on Ubuntu 14.04 with Apache (it's robust and easy to setup). I didn't always say when to use ``sudo`` before the commands to avoid clutter, however you can safely use it everywhere.

## Create and connect to a droplet

Digital Ocean call their virtual machines (VMs) *droplets*. The first step is to log on to their website, create an account and register a bank card. There are many droplet capacity/power offers, personally I began with the 10 dollars per month deal. Once you've created the droplet you will receive a mail with the IP adress of the droplet and the password.

- Open a terminal.
- Connect to the droplet : ``ssh root@<IP adress>``
- Copy/paste the password sent by mail.
- Choose a new very very very secure password

## Add some security

Here are some basic security settings. You will want to install *fail2ban* to blacklist frequent attacks from bots and forbid them from trying to connect with the root user. Like this not only do they have to discover a password, they also have to guess what other users exist on the droplet.

- ``apt-get install fail2ban``
- ``sudo nano /etc/ssh/sshd_config``
- At ``PermitRootLogin`` replace ``yes`` by ``no``

## Some more optional settings

It's a good practice to use another user account with non-permanent ``sudo`` rights. You will also want to set the server's timezone and update it's packages for further installations.

- Create a new user : ``adduser max``
- Allow it to use sudo : ``adduser max sudo``
- Switch users : ``su - max``
- Set timezone : ``dpkg-reconfigure tzdata``
- Update packages : ``sudo apt-get update``

Finally adding a swapfile equal to around twice the system's RAM is a good idea to avoid overloading.

- ``fallocate -l 4G /swapfile``
- ``chmod 600 /swapfile``
- ``mkswap /swapfile``
- ``swapon /swapfile``
- ``sh -c 'echo "/swapfile none swap sw 0 0" >> /etc/fstab'``

## Prepare the website

- Install Apache: ``apt-get install apache2``
- Navigate to the newly create folder: ``cd /var/www/``

I'm going to suppose you have all your code on GitHub (if you don't know what this is then you better do some googling).

- Install git: ``apt-get install git``
- Clone the repository: ``git clone https://github.com/MaxHalford/OpenBikes``
- Make all the files usable by everyone  ``sudo chmod 755 /var/www/OpenBikes -R``

The droplet has Python 3 installed. As this droplet will only host this website there is no point in using a virtual environment, we can directly install the dependencies with the native Python.

- pip is the best for installing Python modules: ``apt-get install python3-pip``
- Install all the modules you should have listed: ``pip3 install -r OpenBikes/setup/requirements.txt``

## Creating an upstart job

OpenBikes uses a never ending script to collect it's data. The modern way to make this run in the background and start when the server reboots is with an upstart script.

- Create the upstart script: ``nano /etc/init/ob-collect.conf``
- Copy paste the following

```sh
start on runlevel [2345]
stop on runlevel [016]
respawn
chdir /var/www/OpenBikes/
exec python3 collect.py
```

- Start the upstart script: ``start ob-collect``

## Launch the website

A Flask app always has a main script to run the website in the localhost. The only you need to add to the repository is a file ending in ``.wsgi``, for example ``openbikes.wsgi``, and add the following:

```python
import sys, os, logging
logging.basicConfig(stream=sys.stderr)
sys.path.insert(0, '/var/www/OpenBikes')
os.chdir('/var/www/OpenBikes')
from serve import app
application = app
```

Now we have to tell Apache where to point visitors who type ``openbikes.co`` in their browser.

- ``nano /etc/apache2/sites-available/OpenBikes.conf``

```sh
<VirtualHost *:80>
	ServerName openbikes.co
	ServerAdmin maxhalford25@gmail.com
	WSGIScriptAlias / /var/www/OpenBikes/openbikes.wsgi
	<Directory /var/www/OpenBikes/>
		Order allow,deny
		Allow from all
	</Directory>
	Alias /static /var/www/OpenBikes/static
	<Directory /var/www/OpenBikes/static/>
		Order allow,deny
		Allow from all
	</Directory>
	ErrorLog ${APACHE_LOG_DIR}/openbikes-error.log
	LogLevel warn
	CustomLog ${APACHE_LOG_DIR}/openbikes-access.log combined
</VirtualHost>
```

Next we have to add the possibility to Apache to serve websites with wsgi.

- ``apt-get install apache2-dev``
- ``pip3 install mod_wsgi``
- ``/usr/local/bin/mod_wsgi-express install-module``
- ``nano /etc/apache2/mods-available/wsgi_express.load``
- Copy/paste ``LoadModule wsgi_module /usr/lib/apache2/modules/mod_wsgi-py34.cpython-34m.so``
- ``nano /etc/apache2/mods-available/wsgi_express.conf``
- Copy/paste ``WSGIPythonHome /usr``
- ``a2enmod wsgi_express``
- ``a2ensite OpenBikes``
- ``service apache2 restart``

Finally we have to set the DNS record of the server so that everything works and point the openbikes.co website to Digital Ocean.

- Add the site in the DNS section of Digital Ocean

![DNS setup](http://i.imgur.com/OTroktF.png)

- Add the Digital Ocean server records to your host provider (in this case [GoDaddy](https://www.godaddy.com/?countryview=1))
	- NS1.DIGITALOCEAN.COM
	- NS2.DIGITALOCEAN.COM
	- NS3.DIGITALOCEAN.COM

![GoDaddy](http://i.imgur.com/CE0IzrP.png)

And voilà, you should be done.

## Remarks

- To update the website from GitHub use ``git pull origin master``
- If you update your website you will have to restart Apache with ``service apache2 restart``
- Some configurations might require a server reboot with ``shutdown -r now``
- If you get errors when connecting to the website's URL check the error log with ``cat /var/log/apache2/error.log``
- To reinstall Apache is case something is broken:

```sh
sudo apt-get remove apache2
sudo apt-get purge apache2
sudo apt-get autoremove
sudo apt-get -y install apache2
```

## Post-scriptum

I voluntarily decided not to fully detail every step. If there is a point you are having a hard time with please put it in the comments so that I can elaborate on it and update this post. The script for deploying OpenBikes is available [here](https://github.com/OpenBikes/Website/blob/master/setup/setup.sh).
