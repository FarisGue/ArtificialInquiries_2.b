# ArtificialInquiries_2b

## Présentation

Ce projet est une adaptation numérique de l'exercice 2b
"All the Things You Could Do" du document
*Artificial Inquiries: A Vademecum for Workers in the Age of AI*.

L'exercice original invite l'utilisateur à réfléchir aux tâches qu'il réalise
actuellement sans l'aide d'un LLM et à identifier les tâches pour lesquelles
une intelligence artificielle pourrait apporter une assistance.

L'objectif n'est pas uniquement d'automatiser le travail, mais d'étudier
comment l'IA peut augmenter les capacités de l'utilisateur.

## Thème

Le projet s'inscrit dans le thème :

**LLM Wiki Is Not a Magic Knowledge Machine**

Plus généralement, le projet s'intéresse à la gestion des connaissances
assistée par l'intelligence artificielle.

La question principale est :

**Comment l'IA peut-elle aider à organiser et maintenir les connaissances
sans remplacer le jugement humain ?**

## Exercice choisi

L'exercice choisi est :

**Exercise 2b – All the Things You Could Do**

Dans l'exercice original, l'utilisateur doit réfléchir aux tâches qu'il
effectue sans LLM et imaginer les tâches pour lesquelles un LLM pourrait
l'aider.

L'idée importante est la différence entre :

- automation : déléguer une tâche à la machine ;
- augmentation : utiliser l'IA pour améliorer ou étendre les capacités humaines.

## Adaptation numérique

L'exercice a été transformé en une application web appelée :

**Human or AI? – Knowledge Task Mapper**

L'utilisateur peut ajouter une tâche puis déterminer le niveau d'assistance
qu'il souhaite recevoir de l'IA.

Trois catégories sont proposées :

- Human Only
- AI Can Assist
- AI Can Do Most of the Task

L'utilisateur peut également préciser :

- ce que l'IA peut faire ;
- ce qui doit rester sous contrôle humain ;
- pourquoi il a choisi ce niveau d'assistance.

## Exemple

Exemple de tâche :

**Organize my university notes**

L'utilisateur peut choisir :

**AI Can Assist**

L'IA peut :
- organiser les notes ;
- résumer les documents ;
- connecter les idées.

L'humain conserve :
- la vérification de l'information ;
- le choix des sources ;
- la décision finale.

## Fonctionnement de l'application

L'application contient quatre étapes :

### 1. Introduction

Présentation de l'exercice et de son objectif.

### 2. Task

L'utilisateur ajoute une tâche et indique son importance et sa fréquence.

### 3. Reflection

L'utilisateur choisit ce que l'IA peut faire et ce qui doit rester sous
contrôle humain.

### 4. Results

L'application affiche les tâches dans trois catégories :

Human Only | AI Can Assist | AI Can Do Most of the Task

Une synthèse est ensuite générée à partir des réponses de l'utilisateur.

## Technologies utilisées

Le prototype utilise uniquement :

- HTML5
- CSS3
- JavaScript

Aucun framework ou serveur n'est nécessaire.

Les données sont enregistrées localement dans le navigateur grâce à
`localStorage`.

## Pourquoi ces technologies ?

HTML permet de créer la structure de l'application.

CSS permet de gérer l'interface graphique et le responsive design.

JavaScript permet de gérer les interactions, les tâches, les résultats
et le stockage local.

Le choix de technologies simples permet de créer un prototype léger,
facile à exécuter et facile à comprendre.

## Stockage des données

Chaque tâche contient plusieurs informations :

- nom de la tâche ;
- importance ;
- fréquence ;
- niveau d'assistance de l'IA ;
- rôles attribués à l'IA ;
- responsabilités humaines ;
- justification de l'utilisateur.

Ces informations sont stockées dans le navigateur avec `localStorage`.

## Objectif pédagogique

L'objectif du prototype n'est pas de décider automatiquement quelles tâches
doivent être confiées à l'IA.

L'utilisateur reste responsable de cette décision.

L'outil sert principalement à provoquer une réflexion sur la répartition
du travail entre humain et intelligence artificielle.

## Lancer le projet

Télécharger ou cloner le repository.

Puis ouvrir simplement :

`index.html`

dans un navigateur web.

Aucune installation supplémentaire n'est nécessaire pour le prototype.

## Omeka S CRUD Interface

`response.html`, `response.css` and `response.js` provide a framework-free,
static interface for creating, reading, updating and deleting `artinq:Task`
items through the Omeka S REST API. No build, npm dependency or backend is
required for this page. The existing vocabulary and database files are unchanged.

### Local usage

1. Start XAMPP.
2. Start Apache and MySQL.
3. Access your Omeka S installation and import the artinq vocabulary if needed.
4. Open `response.html` in a browser (preferably served by a local static server).
5. Enter the Omeka base URL, for example `http://localhost/omeka-s`.
6. Select **Omeka API Keys** and enter the identity and credential keys generated
   in your Omeka user's API keys tab. The user must have permission to edit items.
7. Save configuration and click **Test connection**.
8. Create, read, update or delete Tasks. Existing AIRole, HumanResponsibility and
   Reflection items are loaded into the resource selectors. Delete asks for confirmation.

Configuration, including keys, is saved in this browser's localStorage. This is
only a university/local prototype: use a trusted browser and clear configuration
when finished. Keys are never hard-coded. Debug output redacts keys, although
Omeka's query-string authentication still makes them visible to the browser's
network tools and potentially server logs.

### API and data handling

- `GET /api/items?per_page=1` tests the connection.
- Paginated `GET /api/properties` and `GET /api/resource_classes` discover IDs.
- Paginated `GET /api/items?resource_class_id=...` loads Tasks and related resources.
- `GET /api/items/{id}` loads the current item for editing.
- `POST /api/items`, `PATCH /api/items/{id}` and `DELETE /api/items/{id}` perform writes.

Requests use `fetch()`. Public GET requests are attempted without credentials
first. When both keys are supplied in API Keys mode, authenticated reads follow
so private resources and metadata are retained. Writes require `key_identity`
and `key_credential` query parameters. Invalid credentials are reported instead
of silently falling back to public data.

JSON-LD literal values include discovered `property_id` values. Related items use
`type: resource:item` with `value_resource_id`. New Tasks receive the discovered
`artinq:Task` class and are public. PATCH preserves unrelated RDF metadata and
additional literal values because Omeka replaces its value collection during
partial updates. The editor changes the first literal value and first Reflection
link, retaining additional existing values. A fresh read detects intervening
changes before saving (this is not an atomic server-side concurrency lock).

Reference: [Omeka REST API](https://omeka.org/s/docs/developer/api/rest_api/)
and [resource value format](https://omeka.org/s/docs/developer/api/rest_api_reference/).

### GitHub Pages and connection limitations

Commit these files and enable GitHub Pages for your repository's branch and root
folder under **Settings > Pages**. The intended URL is:
`https://farisgue.github.io/ArtificialInquiries_2b/response.html`.
All asset links are relative and work under a repository subpath.

Localhost always refers to the visitor's own computer. Publishing this page does
not publish Omeka. For other visitors, use a reachable Omeka installation,
preferably HTTPS. Omeka/Apache must allow the page's origin through CORS, including
GET, POST, PATCH, DELETE, OPTIONS and the Content-Type request header. Configure
preflight responses on the server; client JavaScript cannot bypass CORS. HTTPS
pages may encounter mixed-content or local-network browser restrictions when
connecting to HTTP/local servers. Browser fetch errors cannot reliably distinguish
these restrictions from an offline server, so the interface explains the likely causes.

**Local prototype** supports anonymous public API reads; writes require API Keys.
CAS, GitHub OAuth and Google OAuth are informational, unconfigured choices. They
require additional server-side configuration or an authentication provider; the
page does not simulate OAuth authentication.

The navigation link points to the repository root. This checkout does not contain
an `index.html` main application yet; restore that page to make this link lead to
the original mapper.

### Verification

Run `node --check response.js` for an optional developer syntax check (Node is not
needed to use the page). For a live acceptance test, connect to your own Omeka,
create a disposable Task with related resources, edit it, refresh it, then delete
it. Check that unrelated metadata survives editing, invalid keys show an error,
configuration survives reload, and Clear configuration removes the saved keys.
Also test a narrow mobile viewport. No real Omeka writes are performed as part
of the automated mocked API checks.
