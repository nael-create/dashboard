# Actus

> Sources d'actualités (flux RSS) de la page Actus. Modifiable ici ou depuis l'app.
> Les sources privées (lien contenant une clé personnelle) ne sont pas ici : elles restent dans app/data/news.local.json.

## Réglages
widgets: source

## Ordre des widgets

- [x] ft-international
- [x] ft-world
- [x] ft-markets
- [x] ft-global-economy
- [x] reuters
- [x] reuters-business
- [x] reuters-markets
- [x] the-verge
- [x] the-economist
- [x] maddyness
- [x] the-next-web

## FT International
id: ft-international
url: https://www.ft.com/rss/home
category: Monde
color: #e0785a
enabled: yes

## FT World
id: ft-world
url: https://www.ft.com/world?format=rss
category: Monde
color: #d9612f
enabled: yes

## FT Markets
id: ft-markets
url: https://www.ft.com/markets?format=rss
category: Marchés
color: #0d7680
enabled: yes

## FT Global Economy
id: ft-global-economy
url: https://www.ft.com/global-economy?format=rss
category: Économie
color: #990f3d
enabled: yes

## Reuters
id: reuters
url: https://news.google.com/rss/search?q=when:24h+site:reuters.com&ceid=US:en&hl=en-US&gl=US
category: Monde
color: #f97316
enabled: yes
text: yes                    # widget texte : titres affichés même sans image (Google News)

## Reuters Business
id: reuters-business
url: https://news.google.com/rss/search?q=when:24h+site:reuters.com/business&ceid=US:en&hl=en-US&gl=US
category: Business
color: #6366f1
enabled: yes
text: yes                    # widget texte : titres affichés même sans image (Google News)

## Reuters Markets
id: reuters-markets
url: https://news.google.com/rss/search?q=when:7d+site:reuters.com/markets+-site:reuters.com/markets/quote&ceid=US:en&hl=en-US&gl=US
category: Marchés
color: #10b981
enabled: yes

## The Verge
id: the-verge
url: https://www.theverge.com/rss/index.xml
category: Tech
color: #5b3fd1
enabled: yes

## The Economist
id: the-economist
url: https://www.economist.com/latest/rss.xml
category: Monde
color: #c8102e
enabled: yes

## Maddyness
id: maddyness
url: https://www.maddyness.com/feed/
category: Startups
color: #0f9d8a
enabled: yes

## The Next Web
id: the-next-web
url: https://thenextweb.com/feed
category: Tech
color: #ff3c00
enabled: yes
