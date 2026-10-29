// Köpvillkor, integritet och kontakt för butiken.
export const COMPANY = { name: 'Techcom Consulting AB', orgnr: '', email: 'techcomconsultingab@gmail.com', returnAddress: '' };

const seller = () => `${COMPANY.name}${COMPANY.orgnr ? `, org.nr ${COMPANY.orgnr}` : ''}`;

export function termsView(el) {
  el.innerHTML = `<article class="doc">
    <h1>Köpvillkor</h1>
    <p>Gäller köp i Viktresans butik. Säljare är <b>${seller()}</b>, e-post <a href="mailto:${COMPANY.email}">${COMPANY.email}</a>.</p>

    <h2>Priser och betalning</h2>
    <p>Alla priser är i svenska kronor och inklusive 25 % moms. Fraktkostnaden visas i varukorgen innan du betalar. Du betalar med kort via vår betalpartner Stripe. Vi ser aldrig ditt kortnummer.</p>

    <h2>Leverans</h2>
    <p>Varorna skickas direkt från våra leverantörers lager. Leveranstiden står på varje produkt, oftast 5–12 arbetsdagar. Du får ett mejl med spårningsnummer när paketet har skickats. Blir en leverans försenad meddelar vi dig.</p>

    <h2 id="retur">Ångerrätt (14 dagar)</h2>
    <p>Du har rätt att ångra ditt köp inom 14 dagar från den dag du tog emot varan. Gör så här:</p>
    <ul>
      <li>Mejla oss på <a href="mailto:${COMPANY.email}">${COMPANY.email}</a> och skriv att du vill ångra köpet. Du kan också använda ångerblanketten längre ner.</li>
      <li>Vi svarar med var du skickar tillbaka varan${COMPANY.returnAddress ? ` (${COMPANY.returnAddress})` : ''}.</li>
      <li>Skicka varan inom 14 dagar efter att du ångrat dig. Du betalar returfrakten.</li>
      <li>Vi betalar tillbaka hela beloppet, även den ursprungliga frakten, senast 14 dagar efter att vi fått ditt besked. Vi får vänta med återbetalningen tills varan kommit tillbaka.</li>
    </ul>
    <p>Varan ska vara i väsentligen samma skick. Har den använts mer än nödvändigt för att undersöka den kan vi göra avdrag för värdeminskningen.</p>

    <h2 id="angerblankett">Ångerblankett</h2>
    <p>Kopiera texten, fyll i och mejla den till oss:</p>
    <p style="background:#F6F3F8;border-radius:12px;padding:14px;font-size:15px">Till ${seller()}, ${COMPANY.email}<br><br>
      Jag meddelar härmed att jag vill ångra mitt köp av följande vara/varor: …<br>
      Beställd den: … / Mottagen den: …<br>
      Ordernummer: …<br>
      Namn: …<br>Adress: …<br>Datum: …</p>

    <h2>Reklamation</h2>
    <p>Du har rätt att reklamera fel på en vara i tre år enligt konsumentköplagen. Kontakta oss så snart du upptäcker felet, gärna med en bild. Vi står för kostnaden för retur av felaktiga varor.</p>

    <h2>Tvister</h2>
    <p>Vi försöker alltid lösa problem tillsammans med dig. Om vi inte blir överens kan du vända dig till Allmänna reklamationsnämnden, <a href="https://www.arn.se" target="_blank" rel="noopener">arn.se</a>.</p>
  </article>`;
}

export function privacyView(el) {
  el.innerHTML = `<article class="doc">
    <h1>Integritet i butiken</h1>
    <p>${seller()} ansvarar för dina uppgifter när du handlar i butiken.</p>
    <h2>Vad vi sparar</h2>
    <ul>
      <li><b>Varukorgen</b> sparas bara i din egen webbläsare, inte hos oss.</li>
      <li><b>När du beställer</b> sparar vi namn, adress, e-post och telefon för att kunna leverera, ge kundservice och följa bokföringslagen (7 år).</li>
    </ul>
    <h2>Vem får uppgifterna</h2>
    <ul>
      <li><b>Leverantören</b> som skickar varan får namn och leveransadress.</li>
      <li><b>Stripe</b> hanterar betalningen. Vi ser aldrig ditt kortnummer.</li>
    </ul>
    <p>Vi säljer aldrig dina uppgifter. Du kan be om att få se, rätta eller ta bort dem genom att mejla <a href="mailto:${COMPANY.email}">${COMPANY.email}</a>. Du kan också klaga hos Integritetsskyddsmyndigheten, imy.se.</p>
    <p>Appen Viktresan har en egen <a href="/#/integritet">integritetspolicy</a>.</p>
  </article>`;
}

export function contactView(el) {
  el.innerHTML = `<article class="doc">
    <h1>Kontakt</h1>
    <p>Har du frågor om en beställning, en produkt eller appen? Hör av dig så svarar vi så snart vi kan, oftast inom en arbetsdag.</p>
    <h2>E-post</h2>
    <p><a href="mailto:${COMPANY.email}">${COMPANY.email}</a></p>
    <h2>Företag</h2>
    <p>${seller()}</p>
    <p style="margin-top:16px"><a class="btn primary" href="mailto:${COMPANY.email}?subject=Fr%C3%A5ga%20om%20butiken">Skicka mejl</a></p>
  </article>`;
}
