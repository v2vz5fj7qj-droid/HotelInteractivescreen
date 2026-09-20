# Migrations SQL — chemin de mise à niveau historique

Ce dossier sert à **faire évoluer une base déjà en service**. Il n'a pas à être joué
sur une installation neuve.

## Sur une installation neuve

Ne lancez **aucun** fichier de ce dossier. `database/init.sql` contient déjà le schéma
complet et à jour (39 tables), et les évolutions ultérieures sont appliquées au démarrage
du backend par [`backend/src/services/runMigrations.js`](../../backend/src/services/runMigrations.js).

Jouer ces fichiers par-dessus `init.sql` produit des erreurs `Duplicate column name` :
elles sont sans gravité — la colonne existe déjà — mais elles ne servent à rien.

## Sur une base existante

Appliquez uniquement les fichiers postérieurs à votre dernière mise à jour, dans l'ordre :

```bash
docker exec -i connectbe_mysql mysql -u connectbe_user -pchange_me_db connectbe_kiosk \
  < database/migrations/0XX_nom.sql
```

## Rejouabilité

Les migrations `002`, `003`, `004`, `011`, `012` et `014` sont **rejouables** : chaque
opération est conditionnée par une lecture d'`information_schema`. Les autres sont des
`ALTER` bruts, à ne jouer qu'une fois.

> Ces six fichiers utilisaient `ADD COLUMN IF NOT EXISTS` / `DROP INDEX IF EXISTS`,
> syntaxe **MariaDB** que MySQL 8.0 rejette avec `ERROR 1064`. Ils échouaient donc
> silencieusement depuis l'origine. N'utilisez pas cette syntaxe dans une nouvelle
> migration — reprenez le motif `SET @v := (SELECT … information_schema …); PREPARE …`.

## Numérotation : attention au piège

La numérotation de ce dossier est **indépendante** de celle de `runMigrations.js` :

| Fichier SQL | Contenu | Équivalent dans le runner JS |
|---|---|---|
| `014_qr_tokens_hotel_id.sql` | `qr_tokens.hotel_id` | `migration017()` |
| — | table `kiosks` | `migration014()` |

Une migration déposée ici ne part **jamais toute seule**. Pour qu'elle s'applique sur les
déploiements existants, il faut lui écrire un pendant idempotent dans `runMigrations.js`
et l'ajouter au tableau `MIGRATIONS`.
