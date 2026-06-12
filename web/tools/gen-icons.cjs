// Regenerates web/src/catalog/icon-data.ts from the curated Tabler(+MDI) mapping below.
// Run from the repo root with network access:  node web/tools/gen-icons.cjs
// Fetches each glyph once from the Iconify API and inlines it locally (offline/CSP-safe).

const fs=require("fs");
const seed=fs.readFileSync("web/src/catalog/seed.ts","utf8");
const items=[...seed.matchAll(/\{ key: "([^"]+)", categoryKey: "([^"]+)", name: \{ fr: "([^"]+)"/g)].map(m=>({key:m[1],cat:m[2],name:m[3]}));

const TAB={
  apple:["apple"],carrot:["carrot"],salad:["salad"],mushroom:["mushroom"],lemon:["lemon-2","lemon"],avocado:["avocado"],
  "pepper-veg":["pepper"],herbs:["leaf","plant-2"],spinach:["leaf","plant-2"],
  bread:["bread"],"sandwich-bread":["bread"],brioche:["bread"],croissant:["croissant"],
  chicken:["meat"],"chicken-breast":["meat"],"ground-beef":["meat"],steak:["meat"],pork:["meat","pig"],turkey:["meat"],ham:["meat"],
  sausage:["sausage","meat"],merguez:["sausage","meat"],lardons:["meat"],saucisson:["sausage","meat"],chorizo:["sausage","meat"],"cordon-bleu":["meat"],
  salmon:["fish"],cod:["fish"],"white-fish":["fish"],"smoked-salmon":["fish"],surimi:["fish"],tuna:["fish"],"frozen-fish":["fish"],
  milk:["milk"],eggs:["egg"],cheese:["cheese"],camembert:["cheese"],emmental:["cheese"],mozzarella:["cheese"],"goat-cheese":["cheese"],cream:["milk"],compote:["apple"],
  "olive-oil":["bottle"],oil:["bottle"],vinegar:["bottle"],salt:["salt"],pepper:["pepper"],spices:["pepper","salt"],ketchup:["bottle"],soup:["soup"],
  cookies:["cookie"],coffee:["coffee"],tea:["mug"],"hot-chocolate":["mug"],candy:["candy"],
  "frozen-pizza":["pizza"],"ice-cream":["ice-cream-2","ice-cream"],
  water:["droplet","glass-full"],"sparkling-water":["glass-full","bottle"],juice:["glass-full"],soda:["bottle"],"ice-tea":["mug","glass-full"],
  beer:["beer"],wine:["bottle"],champagne:["bottle"],syrup:["bottle"],
  toothpaste:["dental"],toothbrush:["dental"],shampoo:["bottle"],"shower-gel":["bottle"],soap:["soap"],deodorant:["spray"],"toilet-paper":["toilet-paper"],razor:["razor","razor-electric"],
  "dish-soap":["bottle"],"trash-bags":["trash"],laundry:["wash-machine","wash"],softener:["bottle"],bleach:["bottle"],cleaner:["spray"],"paper-towel":["toilet-paper"],
  "baby-food":["baby-bottle"],"baby-milk":["baby-bottle"],"cat-food":["cat"],"dog-food":["dog"],"cat-litter":["paw"],"pet-treats":["bone"],
  batteries:["battery-2","battery"],lightbulb:["bulb"],candle:["candle"],matches:["flame"],
};
const MDI={
  banana:["food"],orange:["fruit-citrus"],clementine:["fruit-citrus"],grapes:["fruit-grapes"],
  strawberry:["fruit-cherries"],raspberry:["fruit-cherries"],watermelon:["fruit-watermelon"],melon:["fruit-watermelon"],
  pineapple:["fruit-pineapple"],"pepper-veg":["chili-mild"],corn:["corn"],nuts:["peanut"],flour:["barley"],
  spices:["chili-mild"],"green-beans":["sprout"],"baking-yeast":["barley"],cereal:["barley"],
  honey:["beehive-outline"],jam:["fruit-cherries"],sugar:["cube-outline"],chocolate:["candy"],spread:["peanut"],
  pasta:["pasta","noodles"],rice:["rice"],soup:["pot-steam"],lentils:["sprout"],chickpeas:["sprout"],
  mustard:["bottle-tonic"],mayo:["bottle-tonic"],"tomato-sauce":["bottle-tonic"],"canned-tomato":["food-variant"],
  olives:["fruit-cherries"],pickles:["food-variant"],stock:["pot-steam"],pesto:["leaf"],chips:["food-variant"],
  yogurt:["cup"],butter:["food-variant"],"fromage-blanc":["cup"],"petit-suisse":["cup"],"dessert-cream":["ice-cream"],
  softener:["bottle-tonic-plus"],bleach:["bottle-tonic-skull"],cleaner:["spray-bottle"],laundry:["washing-machine"],
  "dishwasher-tabs":["dishwasher"],sponge:["dishwasher"],deodorant:["spray"],"paper-towel":["paper-roll"],"toilet-paper":["paper-roll"],
  tissues:["tissue"],cotton:["cotton"],diapers:["human-baby-changing-table"],"baby-wipes":["baby-face-outline"],
  candle:["candle"],matches:["fire"],foil:["foil"],"cling-film":["film"],"freezer-bags":["sack"],
  champagne:["glass-flute"],fries:["french-fries"],"frozen-veg":["sprout"],
};
const FB={"fruits-legumes":"salad",boulangerie:"bread",boucherie:"meat",poissonnerie:"fish",cremerie:"cheese","epicerie-salee":"soup","epicerie-sucree":"cookie",surgeles:"snowflake",boissons:"bottle","hygiene-beaute":"bath",entretien:"spray",bebe:"baby-bottle",animaux:"paw",maison:"home",autre:"shopping-cart"};

async function existing(prefix,names){
  if(!names.length)return new Set();
  const r=await fetch(`https://api.iconify.design/${prefix}.json?icons=${names.join(",")}`);
  const j=await r.json();return new Set(Object.keys(j.icons||{}));
}
const pick=(dict,ok,k)=>(dict[k]||[]).find(n=>ok.has(n));

async function fetchSvg(ref){
  const [prefix,name]=ref.split(":");
  const r=await fetch(`https://api.iconify.design/${prefix}/${name}.svg`);
  let s=await r.text();
  // strip width/height so CSS controls size; keep viewBox + currentColor
  s=s.replace(/\s(width|height)="[^"]*"/g,"");
  return s.replace(/\n/g,"").trim();
}

(async()=>{
  const tabOk=await existing("tabler",[...new Set([...Object.values(TAB).flat(),...Object.values(FB)])]);
  const mdiOk=await existing("mdi",[...new Set(Object.values(MDI).flat())]);

  const keyRef={};   // seedKey -> "prefix:name"
  for(const it of items){
    const t=pick(TAB,tabOk,it.key); if(t){keyRef[it.key]="tabler:"+t;continue;}
    const m=pick(MDI,mdiOk,it.key); if(m){keyRef[it.key]="mdi:"+m;}
  }
  const catRef={};
  for(const[cat,n]of Object.entries(FB)) catRef[cat]= "tabler:"+(tabOk.has(n)?n:"shopping-cart");

  const refs=[...new Set([...Object.values(keyRef),...Object.values(catRef)])];
  // fetch all svgs (chunked)
  const svg={};
  for(let i=0;i<refs.length;i+=12){
    const chunk=refs.slice(i,i+12);
    const res=await Promise.all(chunk.map(fetchSvg));
    chunk.forEach((r,k)=>svg[r]=res[k]);
  }

  const byKey={}; for(const[k,r]of Object.entries(keyRef)) byKey[k]=svg[r];
  const byCat={}; for(const[c,r]of Object.entries(catRef)) byCat[c]=svg[r];

  const esc=s=>s.replace(/`/g,"\\`").replace(/\$\{/g,"\\${");
  let out=`// AUTO-GENERATED by tools/gen-icons — do not edit by hand.\n`;
  out+=`// Tabler (primary) + MDI (fallback) product icons, inlined as local SVG for\n`;
  out+=`// offline use (CSP-safe). Width/height stripped — size via CSS, color via currentColor.\n\n`;
  out+=`/** Seed product key -> inline SVG (only keys with a dedicated icon). */\n`;
  out+=`export const ICON_BY_KEY: Record<string, string> = {\n`;
  for(const[k,v]of Object.entries(byKey)) out+=`  ${JSON.stringify(k)}: \`${esc(v)}\`,\n`;
  out+=`};\n\n/** Aisle fallback icon, one per category key. */\n`;
  out+=`export const CATEGORY_ICON: Record<string, string> = {\n`;
  for(const[k,v]of Object.entries(byCat)) out+=`  ${JSON.stringify(k)}: \`${esc(v)}\`,\n`;
  out+=`};\n`;

  fs.writeFileSync("web/src/catalog/icon-data.ts",out);
  const ded=Object.keys(byKey).length;
  console.log(`icon-data.ts written: ${ded}/166 product icons + ${Object.keys(byCat).length} aisle icons, ${refs.length} unique SVGs`);
})();
