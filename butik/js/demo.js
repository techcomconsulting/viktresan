// Exempelprodukter som bara visas med ?demo i adressen (för att se hur butiken ser ut).
const pic = (emoji, a, b) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><circle cx="200" cy="215" r="120" fill="#fff" opacity=".55"/><text x="200" y="262" font-size="150" text-anchor="middle">${emoji}</text></svg>`);

export const DEMO_SETTINGS = {
  freeShippingOver: 499, shippingPrice: 49, open: false,
  categories: [{ id: 'mata', name: 'Mäta', emoji: '📏' }, { id: 'trana', name: 'Träna', emoji: '🏃' }, { id: 'kok', name: 'Kök och mat', emoji: '🥗' }, { id: 'vardag', name: 'Vardag', emoji: '💧' }]
};

export const DEMO_PRODUCTS = [
  { id: 'smart-vag', title: 'Smart badrumsvåg med kroppsfett', price: 349, comparePrice: 449, category: 'mata', badge: 'Populär', images: [pic('⚖️', '#EFE7FA', '#FBE9F1'), pic('📱', '#E9F3EE', '#F3ECFA')], delivery: '5–9 arbetsdagar', description: 'Mäter vikt, BMI och kroppsfett. Visar på en stor, tydlig display.\n\n• Väger upp till 180 kg\n• Härdat glas\n• Batterier ingår' },
  { id: 'mattband', title: 'Måttband med låsknapp', price: 89, category: 'mata', images: [pic('📏', '#FFF3DC', '#FBE9F1')], delivery: '5–9 arbetsdagar', description: 'Mät midja, höft, arm och lår själv. Låsknappen gör att bandet sitter kvar medan du läser av.' },
  { id: 'vattenflaska', title: 'Vattenflaska 1 liter med tidsmarkering', price: 199, comparePrice: 249, category: 'vardag', badge: 'Nyhet', images: [pic('💧', '#E3F1FB', '#EFE7FA')], delivery: '5–9 arbetsdagar', description: 'Markeringar för varje timme påminner dig om att dricka. Läcktät lock och bärhandtag.' },
  { id: 'gummiband', title: 'Träningsband 5-pack', price: 179, category: 'trana', images: [pic('🏋️', '#E9F3EE', '#E3F1FB')], delivery: '6–10 arbetsdagar', description: 'Fem band med olika motstånd. Perfekt för styrka hemma eller i parken. Påse ingår.' },
  { id: 'hopprep', title: 'Hopprep med räknare', price: 149, category: 'trana', images: [pic('🪢', '#FBE9F1', '#FFF3DC')], delivery: '6–10 arbetsdagar', description: 'Räknar hopp och kalorier automatiskt. Justerbar längd.' },
  { id: 'koksvag', title: 'Digital köksvåg', price: 159, category: 'kok', images: [pic('🍽️', '#F3ECFA', '#E9F3EE')], delivery: '5–9 arbetsdagar', description: 'Väg maten på grammet. Tara-knapp och tydlig display. Väger upp till 5 kg.' },
  { id: 'matlador', title: 'Matlådor i glas 4-pack', price: 299, comparePrice: 349, category: 'kok', images: [pic('🥗', '#E9F3EE', '#FFF3DC')], delivery: '7–12 arbetsdagar', description: 'Förbered veckans mat. Tål ugn, mikro och diskmaskin. Lock med tätningslist.' },
  { id: 'yogamatta', title: 'Yogamatta 6 mm', price: 249, category: 'trana', images: [pic('🧘', '#EFE7FA', '#E3F1FB')], delivery: '6–10 arbetsdagar', description: 'Halkfri och skön. Med bärrem. 183 × 61 cm.' }
];
