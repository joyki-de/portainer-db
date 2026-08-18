# Portainer Dashboard

Ein eigenständiges, leichtgewichtiges Web-Dashboard für [Portainer](https://www.portainer.io/). Ohne Build-Schritt, ohne Framework — nur vanilla HTML, CSS und JavaScript.

## Features

- **Metriken-Übersicht**: Container, Images, Volumes, Networks, Stacks, System-Info
- **Container-Details**: Echtzeit-Charts für CPU, Memory und Network I/O (via uPlot)
- **Light & Dark Mode**: Toggle mit persisted Preference
- **Auto-Refresh**: Konfigurierbares Intervall (10–300 Sekunden)
- **Kein Build nötig**: Dateien direkt im Browser öffnen oder einen einfachen Webserver nutzen

## Voraussetzungen

- Portainer CE oder BE (getestet mit v2.19+)
- Ein moderner Web-Browser (Chrome, Firefox, Edge, Safari)
- Ein Web-Server zum Ausführen (z.B. `python -m http.server`, Nginx, oder `npx serve`)

## Installation

```bash
git clone https://github.com/username/portainer-dashboard.git
cd portainer-dashboard
```

### Einfach starten

```bash
# Python
python3 -m http.server 8080

# oder Node.js
npx serve .

# oder PHP
php -S localhost:8080
```

Dann `http://localhost:8080` im Browser öffnen.

## Docker (empfohlen)

Das einfachste Setup: Docker-Container mit eingebautem nginx, der als Reverse Proxy zu Portainer fungiert. Kein CORS-Problem, keine zusätzliche Konfiguration nötig.

### Schnellstart

```bash
git clone https://github.com/username/portainer-dashboard.git
cd portainer-dashboard

# Portainer-URL in docker-compose.yml anpassen:
# environment:
#   - PORTAINER_URL=https://DEINE_IP:9443

docker compose up -d
```

Dashboard öffnen: `http://DEINE_IP:8080`

### docker-compose.yml

```yaml
services:
  portainer-dashboard:
    build: .
    container_name: portainer-dashboard
    restart: unless-stopped
    ports:
      - "8080:80"
    environment:
      - PORTAINER_URL=https://85.x.x.x:9443  # <-- anpassen
```

### Nur Images verwenden (ohne Build)

```bash
docker compose up -d --build
```

### Port ändern

In `docker-compose.yml` die `ports`-Zeile anpassen:
```yaml
ports:
  - "3000:80"  # Dashboard auf Port 3000
```

### Wie es funktioniert

```
Browser → http://DEINE_IP:8080
                ↓
          nginx (Container)
          ├── /           → Dashboard (statische Dateien)
          └── /api/*      → Proxy zu Portainer API
```

nginx leitet API-Requests automatisch an die in `PORTAINER_URL` konfigurierte Portainer-Instanz weiter. Der Browser sieht nur eine einzige Origin, daher kein CORS-Problem.

### Settings im Docker-Modus

Im Einstellungs-Panel:
- **Portainer URL**: **Leer lassen** (nginx übernimmt den Proxy)
- **Environment ID**: ID der Docker-Environment (Standard: `1`)
- **Authentifizierung**: API Key oder Username/Passwort

## CORS konfigurieren (ohne Docker)

Das Dashboard muss Cross-Origin Requests an Portainer senden. Ohne Konfiguration blockiert der Browser diese Anfragen. Es gibt zwei Lösungen:

### Option 1: Portainer `--trusted-origins` (empfohlen)

Portainer muss die Ursprungsdomain des Dashboards erlauben. Beim Start der Portainer-Container den Parameter `--trusted-origins` hinzufügen:

```bash
docker run -d -p 8000:8000 -p 9443:9443 \
  --name portainer --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce:lts \
  --trusted-origins=http://localhost:8080
```

Mehrere Origins (kommagetrennt):
```bash
--trusted-origins=http://localhost:8080,https://dashboard.example.com
```

Bei Docker Compose:
```yaml
services:
  portainer:
    image: portainer/portainer-ce:lts
    command: >
      --trusted-origins=http://localhost:8080
    ports:
      - "8000:8000"
      - "9443:9443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer_data:/data
```

**Wichtig:** Der Origin muss Schema (http/https), Host und ggf. Port enthalten. Kein trailing slash!

### Option 2: nginx Reverse Proxy

Das Dashboard über nginx bereitstellen, das als Reverse Proxy zu Portainer fungiert. Damit laufen Dashboard und API auf derselben Origin.

Die vorbereitete Konfigurationsdatei `nginx.conf.example` enthält ein Beispiel. Anpassen:

```bash
# nginx.conf.example kopieren und anpassen
cp nginx.conf.example /etc/nginx/sites-available/portainer-dashboard

# Portainer-URL in der Datei ändern:
# proxy_pass https://DEINE_PORTAINER_URL:9443;

# Dashboard-Dateien kopieren
cp -r . /var/www/portainer-dashboard/

# Config aktivieren
ln -s /etc/nginx/sites-available/portainer-dashboard /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

Dann `http://localhost:8080` öffnen — Dashboard und API sind auf derselben Origin, kein CORS-Problem.

## Konfiguration

Beim ersten Start erscheint das Einstellungs-Panel. Folgende Werte werden benötigt:

| Feld | Beschreibung |
|------|-------------|
| **Portainer URL** | Die URL deiner Portainer-Instanz (z.B. `https://portainer.example.com`) |
| **Authentifizierung** | API Key oder Username/Passwort (JWT) |
| **Environment ID** | Die ID der Docker-Environment (Standard: `1`) |
| **Auto-Refresh** | Aktualisierungsintervall in Sekunden (10–300) |

### API Key erstellen

1. In Portainer unter **My Account → Access Tokens** einen neuen Token erstellen
2. Den generierten Key (`ptr_...`) in die Einstellungen eintragen

### JWT (Username/Passwort)

Alternativ können auch Username und Passwort verwendet werden. Der JWT-Token wird automatisch abgerufen und verwaltet.

## Projektstruktur

```
portainer-dashboard/
├── index.html              # Hauptseite
├── Dockerfile              # Docker Image Definition
├── docker-compose.yml      # Docker Compose Konfiguration
├── nginx/
│   └── nginx.conf          # nginx Reverse Proxy Template
├── nginx.conf.example      # nginx ohne Docker (manuell)
├── css/
│   ├── theme.css           # Light/Dark Theme Variablen
│   └── style.css           # Layout und Componenten
├── js/
│   ├── config.js           # Config-Verwaltung (localStorage)
│   ├── api.js              # Portainer API Client
│   ├── dashboard.js        # Dashboard-View (Metriken-Cards)
│   ├── containers.js       # Container-Liste
│   ├── container-detail.js # Container-Detail mit uPlot Charts
│   └── app.js              # Router, Theme, Refresh, Init
└── README.md
```

## Views

### Dashboard
Übersicht mit Metriken-Cards: Portainer-Version, System-Info (CPU/RAM), laufende/gestoppte Container, Images, Volumes, Networks, Stacks.

### Container-Liste
Sortierbare Tabelle aller Container. Klick auf einen laufenden Container öffnet die Detail-Ansicht.

### Container-Detail
Echtzeit-Ansicht mit three Liniendiagrammen:
- **CPU %** (0–100%, rot)
- **Memory %** (0–100%, blau)
- **Network I/O** (RX in Cyan, TX in Orange, auto-scaled)

Stats werden alle 2 Sekunden aktualisiert. Verlauf: ~10 Minuten (300 Datenpunkte).

## Technologien

| Technologie | Version | Lizenz |
|------------|---------|--------|
| [uPlot](https://github.com/leeoniya/uPlot) | 1.6.32 | MIT |
| Vanilla JS | ES6+ | - |
| CSS Custom Properties | - | - |

Keine weiteren externen Abhängigkeiten. uPlot wird via CDN geladen.

## API-Endpoints

Das Dashboard verwendet folgende Portainer API-Endpoints:

| Endpoint | Zweck |
|----------|-------|
| `GET /api/system/status` | Portainer Status |
| `GET /api/system/version` | Version & Update-Info |
| `GET /api/endpoints/{id}/docker/info` | System-Info (CPU, RAM, OS) |
| `GET /api/docker/{id}/dashboard` | Container/Image/Volume/Network Counts |
| `GET /api/endpoints/{id}/docker/containers/json` | Container-Liste |
| `GET /api/endpoints/{id}/docker/containers/{cid}/stats` | Container-Stats (CPU, Mem, Net) |
| `GET /api/stacks` | Stack-Liste |
| `POST /api/auth` | JWT-Login (bei Username/Passwort) |

## Browser-Kompatibilität

- Chrome 90+
- Firefox 90+
- Edge 90+
- Safari 14+

## Sicherheit

- Credentials werden nur im `localStorage` des Browsers gespeichert
- API-Keys werden **nicht** auf dem Server gespeichert
- Keine externen Requests außer an die konfigurierte Portainer-Instanz
- Für produktive Umgebungen: Dashboard über HTTPS und mit authentifiziertem Zugang bereitstellen

## Lizenz

MIT License
