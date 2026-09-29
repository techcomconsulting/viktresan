# Viktresan

En privat webbapp för familjen. Varje person har sitt eget konto.
Allt är privat. Man väljer själv vad man delar och med vem.

Appen fungerar i mobilen och kan läggas på hemskärmen som en vanlig app.

---

## Så får du igång appen

Det tar ungefär 20 minuter. Du behöver inte kunna programmera.

### 1. Skapa ett Firebase-projekt

1. Gå till **console.firebase.google.com**
2. Klicka **Skapa ett projekt**. Döp det till `viktresan`.
3. Google Analytics behövs inte. Stäng av det.

### 2. Slå på inloggning

1. Välj **Build → Authentication** i menyn till vänster.
2. Klicka **Kom igång**.
3. Välj **E-post/lösenord** och slå på det. Spara.

### 3. Skapa databasen

1. Välj **Build → Firestore Database**.
2. Klicka **Skapa databas**.
3. Välj en plats i Europa, till exempel **eur3 (europe)**.
4. Välj **Produktionsläge**.

### 4. Lägg in säkerhetsreglerna

Reglerna ser till att ingen ser något du inte har delat.

1. Gå till fliken **Regler** i Firestore.
2. Ta bort all text som står där.
3. Öppna filen **firestore.rules** här i projektet. Kopiera allt.
4. Klistra in och klicka **Publicera**.

### 5. Koppla appen till Firebase

1. Klicka på **kugghjulet → Projektinställningar**.
2. Under **Dina appar**, klicka på webbikonen **`</>`**.
3. Döp appen till `Viktresan` och klicka **Registrera**.
4. Du ser en ruta med `firebaseConfig`. Den har fyra rader du behöver:
   `apiKey`, `authDomain`, `projectId` och `appId`.
5. Öppna filen **js/config.js** på GitHub. Klicka på pennan.
6. Byt ut `KLISTRA_IN_HAR` mot dina värden. Klicka **Commit changes**.

> Det är okej att de här uppgifterna syns. De är inte hemliga.
> Det är säkerhetsreglerna som skyddar datan.

### 6. Lägg ut appen på nätet (gratis)

1. På GitHub: gå till repot → **Settings → Pages**.
2. Under **Branch**, välj `main` och `/ (root)`. Klicka **Save**.
3. Vänta någon minut. Adressen blir:
   `https://DITT-ANVÄNDARNAMN.github.io/viktresan/`

> Repot måste vara **Public** för gratis GitHub Pages.
> Det är bara koden som syns. Ingen familjedata ligger på GitHub.

### 7. Tillåt adressen i Firebase

1. I Firebase: **Authentication → Inställningar → Auktoriserade domäner**.
2. Klicka **Lägg till domän**.
3. Skriv `DITT-ANVÄNDARNAMN.github.io` och spara.

### 8. Lägg appen på hemskärmen

- **iPhone:** Öppna adressen i Safari → Dela-knappen → **Lägg till på hemskärmen**.
- **Android:** Öppna i Chrome → menyn (tre prickar) → **Installera app**.

Klart! Skapa ditt konto och gör din första mätning.

---

## Bra att veta

- **Kostnad:** Firebase är gratis för en familj. Du behöver inget kort.
- **Bilder** sparas förminskade i databasen. Därför behövs ingen betalplan.
- **Inga pushnotiser.** Notiser syns inne i appen.
- **Radera:** Under Profil kan man radera allt om sig själv.
- **Ny version?** Ändra `viktresan-v1` till `viktresan-v2` i filen `sw.js`.
  Då hämtar mobilerna den nya versionen.

## Filerna

| Fil | Vad den gör |
|---|---|
| `index.html` | Startsidan |
| `css/app.css` | Färger och utseende |
| `js/config.js` | Dina Firebase-uppgifter |
| `js/data.js` | Pratar med databasen |
| `js/views/` | En fil per skärm |
| `firestore.rules` | Säkerhetsreglerna |
| `sw.js`, `manifest.webmanifest` | Gör det till en app |
