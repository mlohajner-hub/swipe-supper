/* Online recipes from TheMealDB (https://www.themealdb.com).
   The raw meals are fetched once and kept on the device (their terms allow it), so planned meals and the
   shopping list keep working offline. This module turns a raw meal into the app's own recipe shape:
   free-text measures -> metric amounts, ingredient names -> the built-in catalogue where possible
   (so they merge on the shopping list), store sections, and diet flags worked out from ingredient names. */
import {aP,aM,aD,aB,aK,aF,aS,AISLES,ING,AISLE_COLOUR} from './data.js';

/* Free test key "1" unless a supporter key is supplied at build time (VITE_MEALDB_KEY, never committed). */
const KEY=(import.meta.env&&import.meta.env.VITE_MEALDB_KEY)||'1';
const API='https://www.themealdb.com/api/json/v1/'+KEY+'/';
export const SERVINGS=4; /* TheMealDB has no servings field; most of its recipes are written for about four. */

/* The whole catalogue, one request per first letter. Desserts are left out: the app plans meals, not puddings. */
export async function fetchAllMeals(){
  const letters='abcdefghijklmnopqrstuvwxyz'.split(''),out=[];
  for(let i=0;i<letters.length;i+=4){
    const batch=await Promise.all(letters.slice(i,i+4).map(async function(l){
      const r=await fetch(API+'search.php?f='+l);
      if(!r.ok)throw new Error('TheMealDB answered '+r.status);
      return ((await r.json()).meals)||[];
    }));
    batch.forEach(function(ms){ms.forEach(function(m){if(m.strCategory!=='Dessert')out.push(m)})});
  }
  return out;
}

/* ---------- measures ---------- */
const FRAC={'½':.5,'¼':.25,'¾':.75,'⅓':1/3,'⅔':2/3,'⅛':.125};
function readNum(s){
  let m;
  if((m=s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/)))return {n:+m[1]+m[2]/m[3],rest:s.slice(m[0].length)};
  if((m=s.match(/^(\d+)\s*\/\s*(\d+)/)))return {n:m[1]/m[2],rest:s.slice(m[0].length)};
  if((m=s.match(/^(\d+(?:[.,]\d+)?)\s*([½¼¾⅓⅔⅛])?/)))return {n:parseFloat(m[1].replace(',','.'))+(m[2]?FRAC[m[2]]:0),rest:s.slice(m[0].length)};
  if((m=s.match(/^([½¼¾⅓⅔⅛])/)))return {n:FRAC[m[1]],rest:s.slice(m[0].length)};
  return null;
}
/* [pattern, stored unit, factor]. Order matters: fluid ounces before ounces, etc. */
const UNIT_RE=[
  [/^(kg|kgs|kilos?|kilograms?)\b/,'g',1000],[/^(g|gr|grams?|gms?|grammes?)\b/,'g',1],
  [/^(ml|mls|millilit(?:re|er)s?)\b/,'ml',1],[/^(cl)\b/,'ml',10],[/^(dl)\b/,'ml',100],[/^(l|ltrs?|lit(?:re|er)s?)\b/,'ml',1000],
  [/^(fl\.?\s?oz|fluid\s+ounces?)\b/,'ml',29.6],[/^(oz|ounces?)\b/,'g',28.35],[/^(lbs?|pounds?)\b/,'g',453.6],
  [/^(cups?)\b/,'ml',240],[/^(pints?|pt)\b/,'ml',568],
  [/^(tbsp|tbsps|tbs|tbls?|tblsp|tablespoons?|tbl)\b/,'tbsp',1],[/^(tsp|tsps|tspn|teaspoons?)\b/,'tsp',1],[/^(dessertspoons?|dsp)\b/,'tsp',2],
  [/^(cloves?)\b/,'cloves',1],[/^(slices?)\b/,'slices',1],[/^(strips?|rashers?)\b/,'slices',1],[/^(sprigs?)\b/,'sprigs',1],
  [/^(tins?|cans?)\b/,'cans',1],[/^(bunch(?:es)?)\b/,'bunches',1],[/^(handfuls?)\b/,'handfuls',1],[/^(sticks?)\b/,'sticks',1],
  [/^(stalks?|ribs?)\b/,'stalks',1],[/^(packets?|packs?|packages?|pkts?|jars?|pots?|bottles?|bags?|boxes)\b/,'packs',1],
  [/^(leaves|leaf)\b/,'leaves',1]
];
const VAGUE=/pinch|dash|splash|to taste|to serve|for frying|garnish|drizzle|as required|as needed|sprinkl|for greasing|for dusting|to fry|for brushing|optional|some|spray/i;

/* Free-text measure -> {amt, unit}. amt 0 means "some" (a pinch, to taste, for frying). */
export function parseMeasure(raw){
  const s=String(raw||'').trim().toLowerCase().replace(/\s+/g,' ');
  if(!s)return {amt:0,unit:'pcs'};
  let num=readNum(s);
  if(!num){
    if(VAGUE.test(s))return {amt:0,unit:'pcs'};
    for(const u of UNIT_RE)if(u[0].test(s))return {amt:u[2],unit:u[1]}; /* "Handful", "Cup" */
    const m=s.match(/(\d+(?:[.,]\d+)?)/); /* "Juice of 1" */
    if(m)return {amt:parseFloat(m[1].replace(',','.')),unit:'pcs'};
    return {amt:0,unit:'pcs'};
  }
  let rest=num.rest.trim(),n=num.n;
  const range=rest.match(/^(?:-|–|to)\s*/);
  if(range){const up=readNum(rest.slice(range[0].length));if(up){n=Math.max(n,up.n);rest=up.rest.trim()}} /* "2-3": buy for 3 */
  const times=rest.match(/^(x|×)\s*/);
  if(times){const inner=readNum(rest.slice(times[0].length));rest=rest.slice(times[0].length);if(inner){n*=inner.n;rest=inner.rest.trim()}} /* "2 x 400g tins" */
  for(const u of UNIT_RE)if(u[0].test(rest))return {amt:n*u[2],unit:u[1]};
  if(/^(pinch|dash|splash)/.test(rest))return {amt:0,unit:'pcs'};
  return {amt:n,unit:'pcs'}; /* "2", "1 medium", "3 chopped" */
}

/* ---------- ingredients ---------- */
const SKIP=/^(null|undefined|salt|sea salt|table salt|kosher salt|salt and pepper|pepper|black pepper|ground black pepper|white pepper|water|cold water|warm water|hot water|boiling water|ice|ice cubes)$/;
/* MealDB names that are the same thing as a built-in ingredient, so they merge with the starter recipes. */
const ALIAS={
  'onion':'onion','onions':'onion','brown onion':'onion','yellow onion':'onion','white onion':'onion','red onion':'redonion','red onions':'redonion',
  'garlic':'garlic','garlic clove':'garlic','garlic cloves':'garlic','carrot':'carrot','carrots':'carrot','potato':'potato','potatoes':'potato',
  'sweet potato':'sweetpotato','sweet potatoes':'sweetpotato','tomato':'tomato','tomatoes':'tomato','cherry tomatoes':'cherrytomato','cucumber':'cucumber',
  'red pepper':'bellpepper','green pepper':'bellpepper','yellow pepper':'bellpepper','bell pepper':'bellpepper','red bell pepper':'bellpepper',
  'broccoli':'broccoli','spinach':'spinach','baby spinach':'spinach','mushroom':'mushroom','mushrooms':'mushroom','lemon':'lemon','lemons':'lemon',
  'lime':'lime','limes':'lime','avocado':'avocado','ginger':'ginger','fresh ginger':'ginger','red chilli':'chili','red chili':'chili','chilli':'chili',
  'dill':'dill','parsley':'parsley','fresh parsley':'parsley','coriander':'coriander','fresh coriander':'coriander','cilantro':'coriander',
  'basil':'basil','fresh basil':'basil','basil leaves':'basil','banana':'banana','bananas':'banana','spring onion':'scallion','spring onions':'scallion','scallions':'scallion',
  'chicken breast':'chicken','chicken breasts':'chicken','minced beef':'beefmince','beef mince':'beefmince','ground beef':'beefmince','bacon':'bacon',
  'salmon':'salmon','salmon fillets':'salmon','prawns':'shrimp','king prawns':'shrimp','shrimp':'shrimp','tuna':'tuna','egg':'egg','eggs':'egg','milk':'milk',
  'double cream':'cream','heavy cream':'cream','single cream':'cream','greek yogurt':'yoghurt','greek yoghurt':'yoghurt','butter':'butter','unsalted butter':'butter',
  'parmesan':'parmesan','parmesan cheese':'parmesan','cheddar cheese':'cheese','feta':'feta','feta cheese':'feta','mozzarella':'mozzarella','halloumi':'halloumi',
  'bread':'bread','tortillas':'tortilla','flour tortilla':'tortilla','pita bread':'pita','oats':'oats','rolled oats':'oats','breadcrumbs':'breadcrumbs','pasta':'pasta',
  'rice':'rice','basmati rice':'rice','long grain rice':'rice','white rice':'rice','arborio rice':'risottorice','arborio risotto rice':'risottorice',
  'rice noodles':'ricenoodles','rice vermicelli':'ricenoodles','quinoa':'quinoa','red lentils':'lentils','chickpeas':'chickpeas','black beans':'blackbeans',
  'chopped tomatoes':'tomatocan','canned tomatoes':'tomatocan','tinned tomatoes':'tomatocan','tomato puree':'tomatopaste','tomato paste':'tomatopaste',
  'coconut milk':'coconutmilk','soy sauce':'soy','honey':'honey','red curry paste':'currypaste','olives':'olives','black olives':'olives',
  'vegetable stock cube':'stockcube','plain flour':'flour','flour':'flour','frozen peas':'frozenpeas','peas':'frozenpeas','olive oil':'oil','extra virgin olive oil':'oil',
  'cumin':'cumin','ground cumin':'cumin','paprika':'paprika','smoked paprika':'paprika','oregano':'oregano','dried oregano':'oregano','curry powder':'currypowder',
  'chilli flakes':'chiliflakes','red pepper flakes':'chiliflakes'
};
/* Diet flags from ingredient names. Exclusions are removed from the name first ("coconut milk" is not dairy). */
const NOT={
  dairy:/coconut (milk|cream)|almond milk|oat milk|soy(a)? milk|rice milk|peanut butter|cocoa butter|butter beans?|butternut|cream of tartar|(vegan|dairy[- ]free|plant[- ]based) \w+/g,
  gluten:/(corn|rice|gram|chickpea|almond|coconut|potato|tapioca|cassava|buckwheat|maize|teff|sorghum|millet|quinoa) ?flour|(vermicelli )?rice (stick )?(noodles|vermicelli)|glass noodles|corn tortillas?|gluten[- ]free \w+|tamari/g,
  nuts:/nutmeg|coconut|butternut|doughnut|water chestnuts?/g,
  meat:/veg(etable)? stock|(vegan|vegetarian|meat[- ]free) \w+|beef tomato(es)?|kidney beans?|minced (garlic|ginger)/g,
  fish:/oyster mushrooms?|vegan \w+/g,
  egg:/egg ?plants?|flax eggs?|vegan \w+/g
};
const FLAGS=[
  ['meat',/\b(meat|mincemeat|frogs?|jam[oó]n|ib[eé]rico|snails?|escargots?|bresaola|speck|nduja|guanciale|biltong|pastrami|spam|bone broth|beef|chicken|pork|lamb|mutton|goat|veal|turkey|duck|goose|bacon|ham|sausages?|chorizo|salami|pepperoni|prosciutto|pancetta|lardons?|mince|steaks?|brisket|oxtail|kidneys?|liver|gelatine|gelatin|suet|lard|venison|rabbit|gravy|meatballs?|black pudding|haggis|serrano|jamon|kielbasa|frankfurters?|hot dogs?|bratwurst|pheasant|quail|pigeon|dripping|chops?|ribs|bone|marrow|tripe|tongue|cutlets?|drumsticks?|thighs?|wings?|fillet steak|sirloin|rump|shoulder|mortadella)\b/],
  ['fish',/\b(\w*fish|barramundi|conchs?|conches|cuttlefish|branzino|mahi|perch|pike|carp|sprats?|pilchards?|abalone|sea urchin|shrimp paste|kingfish|dorado|grouper|turbot|john dory|bream|skate|zander|gravlax|lox|tilefish|bacalao|salmon|tuna|cod|haddock|mackerel|sardines?|anchov(y|ies)|prawns?|shrimps?|crab|lobster|mussels?|clams?|oysters?|scallops?|squid|calamari|octopus|herring|trout|tilapia|sea bass|bass|monkfish|halibut|plaice|sole|kippers?|caviar|roe|worcestershire|fish sauce|oyster sauce|dashi|bonito|seafood|langoustines?|crayfish|whitebait|swordfish|snapper|pollock|hake|eel|surimi|bacalhau|saltfish|cockles?|whelks?)\b/],
  ['dairy',/\b(milk|butter|cream|cheese|cheddar|parmesan|parmigiano|mozzarella|feta|ricotta|mascarpone|yogh?urt|ghee|cr[eè]me fra[iî]che|brie|gruy[eè]re|halloumi|paneer|buttermilk|custard|quark|stilton|gouda|emmental|camembert|pecorino|gorgonzola|monterey jack|curd|whey|kefir|labneh|queso|manchego|edam|provolone|fontina|taleggio|burrata|smetana|skyr)\b/],
  ['egg',/\b(eggs?|egg yolks?|egg whites?|mayonnaise|mayo|meringue|aioli)\b/],
  ['gluten',/\b(flour|bread|breadcrumbs|panko|pasta|spaghetti|penne|linguine|fettuccine|tagliatelle|lasagne|lasagna|macaroni|fusilli|rigatoni|farfalle|orzo|noodles|udon|couscous|bulgu?h?r|barley|semolina|rye|spelt|wheat|pastry|filo|phyllo|tortillas?|pitta|pita|naan|baguette|brioche|croissants?|crackers?|biscuits?|digestives?|soy sauce|beer|ale|stout|lager|malt|seitan|wonton|dumplings?|gnocchi|ciabatta|buns?|muffins?|crumpets?|cake|stuffing|oats|oatmeal|porridge|cereal|teriyaki|hoisin|worcestershire|vermicelli|ravioli|tortellini|cannelloni|pappardelle|conchiglie|ditalini|bagels?|rolls?|toast|wraps?|chapati|roti|paratha|pretzels?)\b/],
  ['nuts',/\b(almonds?|walnuts?|cashews?|peanuts?|pecans?|hazelnuts?|pistachios?|pine nuts?|macadamias?|brazil nuts?|nuts|peanut butter|nutella|marzipan|praline|frangipane|satay|nut butter|almond)\b/],
  ['animal',/\b(honey)\b/]
];
export function dietFlags(name){
  const n=name.toLowerCase(),out=[];
  FLAGS.forEach(function(f){const s=NOT[f[0]]?n.replace(NOT[f[0]],' '):n;if(f[1].test(s))out.push(f[0])});
  return out.join(' ');
}
/* Store section from the name and flags. Unknown things go to Pantry. */
const PRODUCE=/\b(onions?|shallots?|garlic|carrots?|potato(es)?|tomato(es)?|peppers?|chill(i|ies|y)|jalape[nñ]os?|lettuce|cabbage|leeks?|celery|courgettes?|zucchini|aubergines?|eggplants?|squash|pumpkin|spinach|kale|chard|broccoli|cauliflower|mushrooms?|lemons?|limes?|oranges?|apples?|pears?|bananas?|berries|strawberries|raspberries|blueberries|avocados?|ginger|parsley|coriander leaves|fresh coriander|basil|mint|dill|thyme|rosemary|sage|chives|tarragon|beansprouts|bean sprouts|cucumbers?|radish(es)?|beetroots?|fennel|asparagus|sweetcorn|corn on the cob|parsnips?|turnips?|swede|okra|green beans|runner beans|mangetout|sugar snap|pak choi|bok choy|watercress|rocket|arugula|salad|mangoes?|mango|pineapple|grapes?|cherries|plums?|peach(es)?|nectarines?|figs?|pomegranates?|lemongrass|spring onions?|scallions?|herbs|plantains?|cassava|yams?|edamame|artichokes?|kiwi|melon|watermelon|papaya|coconut flesh)\b/;
const BASICS=/\b(oil|ground|powder|paprika|cumin|turmeric|cinnamon|nutmeg|oregano|cayenne|garam masala|seeds|bay leaf|bay leaves|allspice|cardamom|fenugreek|saffron|star anise|five spice|spice|seasoning|dried herbs|mixed herbs|peppercorns|chilli flakes|chili flakes|curry powder|za'?atar|sumac|vanilla|stock cubes?|bouillon|msg)\b/;
const BAKERY=/\b(bread|baguette|ciabatta|brioche|rolls?|buns?|tortillas?|pitta|pita|naan|wraps?|croissants?|bagels?|oats|muesli|cereal|crumpets?|muffins?)\b/;
function aisleFor(name,flags,unit){
  const n=name.toLowerCase();
  if(/\bfrozen\b/.test(n))return aF;
  if(/\b(tinned|canned|tin of|can of|dried|jar)\b/.test(n))return aK;
  if(/\b(stock|broth)\b/.test(n)&&!/cubes?/.test(n))return aK;
  if(BASICS.test(n)&&!/\b(fresh)\b/.test(n))return aS;
  if(/\b(thyme|rosemary|sage|mint|basil|oregano|coriander|parsley|dill|tarragon)\b/.test(n)&&(unit==='tsp'||unit==='tbsp')&&!/fresh/.test(n))return aS;
  if(/\b(anchov|tuna|sardines?)\b/.test(n))return aK;
  if(/\b(meat|fish)\b/.test(flags))return aM;
  if(/\b(dairy|egg)\b/.test(flags)&&!/\b(mayonnaise|mayo|aioli)\b/.test(n))return aD;
  if(BAKERY.test(n))return aB;
  if(PRODUCE.test(n))return aP;
  return aK;
}
function slug(s){return String(s).toLowerCase().trim().replace(/\s+/g,' ')}
function titleCase(s){return s.replace(/\b\w/g,function(c){return c.toUpperCase()}).replace(/\b(And|Of|With|In)\b/g,function(w){return w.toLowerCase()})}
const COMPAT={g:{g:1},ml:{ml:1,tbsp:1/15,tsp:1/5},tbsp:{tbsp:1,tsp:1/3,ml:15},tsp:{tsp:1,tbsp:3,ml:5},cloves:{cloves:1,pcs:1},pcs:{pcs:1},slices:{slices:1}};
/* One MealDB ingredient line -> [ING key, amount for the recipe's servings], registering new catalogue entries as needed. */
function ingLine(name,measure){
  const nm=slug(name);
  if(!nm||SKIP.test(nm))return null;
  const q=parseMeasure(measure),known=ALIAS[nm];
  if(known){
    const ku=ING[known][1],f=COMPAT[q.unit]&&COMPAT[q.unit][ku];
    if(f)return [known,q.amt*f];
    if(q.amt===0)return [known,0];
  }
  const key='m:'+nm+'|'+q.unit;
  if(!ING[key]){
    const flags=known?ING[known][3]:dietFlags(nm),aisle=known?ING[known][2]:aisleFor(nm,flags,q.unit);
    ING[key]=[known?ING[known][0]:titleCase(String(name).trim()),q.unit,aisle,flags,known?ING[known][4]:(AISLE_COLOUR[aisle]||'#C9B24A')];
  }
  return [key,q.amt];
}

/* ---------- recipes ---------- */
const AREA_TAG={Italian:'Italian',Mexican:'Mexican',Chinese:'Asian',Japanese:'Asian',Thai:'Asian',Vietnamese:'Asian',India:'Asian',Indian:'Asian',Malaysian:'Asian',Filipino:'Asian',
  Norway:'Nordic',Norwegian:'Nordic',Swedish:'Nordic',Danish:'Nordic',Finnish:'Nordic',Greek:'Mediterranean',Turkish:'Mediterranean',Spanish:'Mediterranean',Portuguese:'Mediterranean',
  Moroccan:'Mediterranean',Croatian:'Mediterranean',Tunisian:'Mediterranean',Syrian:'Mediterranean',Egyptian:'Mediterranean',Algerian:'Mediterranean',Lebanese:'Mediterranean'};
const AREA_NAME={India:'Indian',Norway:'Norwegian',Netherlands:'Dutch',France:'French',Argentina:'Argentinian',Venezuela:'Venezuelan',Slovakia:'Slovak','United States':'American','Saudi Arabian':'Saudi'};
function splitSteps(text){
  return String(text||'').split(/\r?\n|(?=\bSTEP\s*\d+)/i)
    .map(function(s){return s.replace(/^\s*(step\s*\d+[:.)-]?|\d+[.)]\s+|[▢•\-–]\s*)/i,'').trim()})
    .filter(function(s){return s.length>2&&!/^step\s*\d+$/i.test(s)});
}
/* Raw meal -> the arguments the app's buildRecipe takes, plus online-only extras. Amounts are per 2 servings like the starters. */
export function convertMeal(m){
  const per2=2/SERVINGS,ings=[],seen={};
  for(let i=1;i<=20;i++){
    const l=ingLine(m['strIngredient'+i],m['strMeasure'+i]);if(!l)continue;
    if(seen[l[0]]!==undefined){ings[seen[l[0]]][1]+=l[1]*per2;continue}
    seen[l[0]]=ings.length;ings.push([l[0],l[1]*per2]);
  }
  const cat=m.strCategory,name=String(m.strMeal).trim(),soup=/\b(soup|broth|chowder|bisque|stew)\b/i.test(name);
  const meals=cat==='Breakfast'?['breakfast']:(cat==='Side'||cat==='Starter')?['lunch']:(cat==='Pasta'||cat==='Vegetarian'||cat==='Vegan'||soup)?['lunch','dinner']:['dinner'];
  const tags=[];
  if(AREA_TAG[m.strArea])tags.push(AREA_TAG[m.strArea]);
  if(/\bsoup\b/i.test(name)||/\bsoup\b/i.test(m.strTags||''))tags.push('Soup');
  if(/\bbowl\b/i.test(name))tags.push('Bowl');
  if(m.strArea&&m.strArea!=='Unknown')tags.push(AREA_NAME[m.strArea]||m.strArea);
  return {id:'mdb-'+m.idMeal,name:name,meals:meals,tags:tags,ings:ings,steps:splitSteps(m.strInstructions),
    image:m.strMealThumb||'',source:m.strSource||'',link:'https://www.themealdb.com/meal/'+m.idMeal};
}
