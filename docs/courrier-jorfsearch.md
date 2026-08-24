# Courrier à envoyer au mainteneur de JORFSearch

À envoyer **avant** de mettre les pages personnes en ligne, pas après. Adresse :
`nathann.cohen@gmail.com` (indiquée sur jorfsearch.steinertriples.ch).

Deux points à ne pas oublier, parce qu'ils appellent une réponse :
le plafond de requêtes qui lui convient, et la licence de rediffusion.

---

**Objet :** JOEL — usage de JORFSearch, plafond de requêtes et question de licence

Bonjour,

Je suis l'un des développeurs de JOEL (https://www.joel-officiel.fr), un
service associatif et open source qui prévient ses utilisateurs quand une
personne de leur réseau est citée au Journal officiel. JOEL s'appuie sur
JORFSearch depuis ses débuts, et je vous en remercie : sans votre travail le
service n'existerait pas.

Nous nous apprêtons à publier des pages consultables par personne, et je
préfère vous décrire ce que cela implique côté charge avant de le mettre en
ligne plutôt que de vous laisser le découvrir dans vos journaux.

**Ce que nous appelons, et à quel rythme.** Nos requêtes portent l'en-tête
suivant, pour que vous puissiez nous identifier et nous joindre :

    User-Agent: JOEL-QR/1.0 (+https://www.joel-officiel.fr; contact@joel-officiel.fr)

Nous avons mis en place, côté JOEL : un cache de 6 heures par personne, un
cache négatif pour les noms inconnus, la fusion des requêtes simultanées
portant sur un même nom (N visiteurs sur une page produisent un seul appel chez
vous), un plafond de 4 requêtes simultanées, un délai d'attente de 3 secondes,
une seule reprise avec temporisation, et un disjoncteur qui cesse de vous
appeler pendant 60 secondes après 5 échecs consécutifs. Nous nous fixons un
plafond de 20 000 requêtes par jour, et nous constatons en pratique un ordre de
grandeur bien inférieur.

**Ma question :** ce plafond vous convient-il ? Si vous préférez un chiffre
plus bas, une plage horaire, ou un autre en-tête, dites-le moi et je l'applique.

**Sur le fichier `all.xml`.** Si nous l'utilisons, ce sera avec
`If-Modified-Since` et `ETag`, pour ne rien retélécharger tant que rien n'a
changé. Là encore, dites-moi si vous préférez que nous nous en abstenions.

**Sur la licence, et c'est le point le plus important.** La ressource publiée
sur data.gouv.fr porte la mention « licence non spécifiée ». Nous envisageons
de dériver de ces données un index de noms qui serait distribué avec une
extension de navigateur. Rediffuser un artefact dérivé de votre travail sans
licence explicite ne me paraît pas correct, et je ne le ferai pas sans votre
accord. Accepteriez-vous cette rediffusion, et sous quelles conditions
d'attribution ? Si vous préférez que nous ne le fassions pas, nous
reconstruirons l'index depuis les données de la DILA, sous Licence Ouverte.

Nous citons JORFSearch comme source sur chaque page publiée, avec un lien vers
la fiche correspondante chez vous.

Bien cordialement,

Dany Mestas
JOEL — contact@joel-officiel.fr
