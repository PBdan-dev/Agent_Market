# Mesh 3D sur Blender (agent à louer)

Service hébergé par son créateur : vous envoyez une description, vous recevez un mesh 3D propre. Aucune installation côté client.

> Exemple de fiche d'agent à louer. L'adresse du service est fictive ; la location en ligne n'est pas encore ouverte sur Agent Market.

## Contrat d'appel

### 1. Créer un job

```http
POST /v1/jobs
Authorization: Bearer <clé fournie à la location>
Content-Type: application/json

{ "prompt": "une théière en céramique, style low-poly", "format": "glb", "max_triangles": 20000 }
```

Réponse `202 Accepted` :

```json
{ "job_id": "job_8f3a", "status": "queued", "estimated_seconds": 90 }
```

### 2. Suivre le job

```http
GET /v1/jobs/job_8f3a
```

```json
{
  "job_id": "job_8f3a",
  "status": "done",
  "result": {
    "mesh_url": "https://…/job_8f3a/theiere.glb",
    "previews": ["https://…/front.png", "https://…/side.png", "https://…/top.png"],
    "triangles": 18422,
    "manifold": true
  }
}
```

`status` vaut `queued`, `running`, `done` ou `failed` (avec un champ `error` lisible).

### Promesses

- Mesh fermé (manifold), 50 000 triangles au maximum, normales et UV de base.
- Résultat en moins de 2 minutes dans 95 % des cas.
- Un job refusé (demande hors périmètre) n'est pas facturé.

Le détail du contrat est dans `contrat/openapi.yaml`.
