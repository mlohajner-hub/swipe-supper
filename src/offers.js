/* Store offers. One normalised shape whatever the source (typed in by you today, a licensed feed later):
   {id, chain, storeId, storeName, product, price, unitPrice, unitPriceUnit, regularPrice, validFrom, validTo,
    memberOnly, item, source}
   - chain: one of CHAINS; storeId: an OpenStreetMap store id from your chosen stores, or '' for every store of the chain
   - price, unitPrice, regularPrice: kronor (unitPrice per unitPriceUnit: 'kg', 'l' or 'st'); regularPrice is optional
   - validFrom/validTo: 'YYYY-MM-DD', both days included
   - item: the shopping-list ingredient key it is for ('' = work it out from the product name) */

/* Swedish shop names for the built-in ingredients, so an offer like "Kycklingfilé 900g" finds "Chicken breast". */
export const SV={
  onion:['gul lök','gula lökar','lök'],redonion:['rödlök','röd lök'],garlic:['vitlök'],carrot:['morot','morötter'],
  potato:['potatis'],sweetpotato:['sötpotatis'],tomato:['tomat','tomater'],cherrytomato:['körsbärstomat','cocktailtomat','småtomat'],
  cucumber:['gurka','slanggurka'],bellpepper:['paprika'],broccoli:['broccoli'],spinach:['spenat','babyspenat'],
  mushroom:['champinjon','svamp'],lemon:['citron'],lime:['lime'],avocado:['avokado'],lettuce:['sallad','salladsmix','isbergssallad','romansallad'],
  ginger:['ingefära'],chili:['chili','chilipeppar'],dill:['dill'],parsley:['persilja'],coriander:['koriander'],basil:['basilika'],
  banana:['banan'],scallion:['salladslök','vårlök'],chicken:['kycklingfilé','kycklingbröst','kycklinginnerfilé'],beefmince:['nötfärs'],
  bacon:['bacon'],sausage:['falukorv','rökt korv','grillkorv','korv'],salmon:['laxfilé','lax'],shrimp:['räkor','räka','scampi'],
  tuna:['tonfisk'],egg:['ägg'],milk:['mjölk'],cream:['matlagningsgrädde','vispgrädde','grädde'],yoghurt:['grekisk yoghurt','turkisk yoghurt','yoghurt'],
  butter:['smör'],parmesan:['parmesan','parmigiano'],cheese:['riven ost','hushållsost','herrgårdsost','prästost','grevé','cheddar'],
  feta:['fetaost','feta'],mozzarella:['mozzarella'],halloumi:['halloumi'],bread:['bröd','limpa','formbröd','rostbröd'],
  tortilla:['tortillabröd','tortilla','wraps'],pita:['pitabröd','pita'],oats:['havregryn'],muesli:['müsli','musli','granola'],
  breadcrumbs:['ströbröd'],pasta:['pasta','spaghetti','penne','fusilli','makaroner'],rice:['jasminris','basmatiris','långkornigt ris','ris'],
  risottorice:['risottoris','arborio'],ricenoodles:['risnudlar'],quinoa:['quinoa'],lentils:['röda linser','linser'],
  chickpeas:['kikärtor','kikärter'],blackbeans:['svarta bönor'],tomatocan:['krossade tomater','tomatkross','passerade tomater'],
  tomatopaste:['tomatpuré'],coconutmilk:['kokosmjölk'],soy:['sojasås','soja'],honey:['honung'],currypaste:['röd currypasta','currypasta'],
  lingonberry:['lingonsylt','rårörda lingon','lingon'],olives:['oliver'],stockcube:['grönsaksbuljong','buljong'],flour:['vetemjöl'],
  frozenberries:['frysta bär','bärmix','frysta hallon','frysta blåbär'],frozenpeas:['gröna ärtor','frysta ärter','ärtor'],oil:['olivolja'],
  cumin:['spiskummin'],paprika:['rökt paprika','paprikapulver'],oregano:['oregano'],currypowder:['currypulver','curry'],
  chiliflakes:['chiliflakes','chiliflingor'],tacoseasoning:['tacokrydda']
};

function norm(s){return String(s).toLowerCase().replace(/[åä]/g,'a').replace(/ö/g,'o').replace(/[éè]/g,'e').replace(/ü/g,'u').replace(/\s+/g,' ').trim()}
/* Short words must start a word ("lax", not "relax"); longer ones may sit inside a compound ("färskpotatis"). */
function hit(text,word){
  const i=text.indexOf(word);if(i<0)return false;
  if(word.length>=5)return true;
  for(let j=i;j>-1;j=text.indexOf(word,j+1))if(j===0||!/[a-z0-9]/.test(text[j-1]))return true;
  return false;
}
/* Product name -> best matching ingredient key among `keys` (the longest matching name wins, so
   "Sötpotatis" is sweet potato rather than potato), or ''. names(key) gives English names to try too. */
export function matchItem(product,keys,names){
  const p=norm(product);let best='',len=0;
  keys.forEach(function(k){
    (SV[k]||[]).concat(names?names(k):[]).forEach(function(w){const n=norm(w);if(n.length>len&&hit(p,n)){best=k;len=n.length}});
  });
  return best;
}

export function todayISO(d){d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
export function isActive(o,today){today=today||todayISO();return (!o.validFrom||o.validFrom<=today)&&(!o.validTo||o.validTo>=today)}
/* Sunday of this week, the usual end of a Swedish weekly offer. */
export function thisSunday(){const d=new Date();d.setDate(d.getDate()+((7-d.getDay())%7));return todayISO(d)}
export function kr(n){return n==null||isNaN(n)?'':(Math.round(n*100)/100).toFixed(2).replace('.',',')+' kr'}
export function shortDate(iso){if(!iso)return '';const p=iso.split('-');return new Date(+p[0],+p[1]-1,+p[2]).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}
