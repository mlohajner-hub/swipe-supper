/* Built-in ingredient catalogue and starter recipes. */

export const aP="Produce",aM="Meat & fish",aD="Dairy & eggs",aB="Bakery & cereals",aK="Pantry",aF="Frozen",aS="Basics";
export const AISLES=[aP,aM,aD,aB,aK,aF,aS];
/* key: [name, unit, aisle, allergen flags, plate colour] */
export const ING={
  onion:["Yellow onion","pcs",aP,"","#E3C58B"],
  redonion:["Red onion","pcs",aP,"","#9E4E7A"],
  garlic:["Garlic","cloves",aP,"","#EFE6CF"],
  carrot:["Carrots","pcs",aP,"","#E8892E"],
  potato:["Potatoes","g",aP,"","#E7D49A"],
  sweetpotato:["Sweet potatoes","g",aP,"","#E08A3C"],
  tomato:["Tomatoes","pcs",aP,"","#D9432F"],
  cherrytomato:["Cherry tomatoes","g",aP,"","#E04B35"],
  cucumber:["Cucumber","pcs",aP,"","#8BBE6B"],
  bellpepper:["Bell peppers","pcs",aP,"","#E4572E"],
  broccoli:["Broccoli","g",aP,"","#4F9A48"],
  spinach:["Baby spinach","g",aP,"","#3F8A3F"],
  mushroom:["Mushrooms","g",aP,"","#B79A7C"],
  lemon:["Lemons","pcs",aP,"","#EFD85A"],
  lime:["Limes","pcs",aP,"","#9CC84F"],
  avocado:["Avocados","pcs",aP,"","#87A83F"],
  lettuce:["Salad leaves","g",aP,"","#7CB35A"],
  ginger:["Fresh ginger","g",aP,"","#E6CE8F"],
  chili:["Red chili","pcs",aP,"","#CC2E24"],
  dill:["Fresh dill","g",aP,"","#5E9B4B"],
  parsley:["Fresh parsley","g",aP,"","#4C9140"],
  coriander:["Fresh coriander","g",aP,"","#55A044"],
  basil:["Fresh basil","g",aP,"","#3E8F3E"],
  banana:["Bananas","pcs",aP,"","#F0D262"],
  scallion:["Spring onions","pcs",aP,"","#6DAE55"],
  chicken:["Chicken breast","g",aM,"meat","#E9C9A0"],
  beefmince:["Beef mince","g",aM,"meat","#8B4A33"],
  bacon:["Bacon","g",aM,"meat","#C4604A"],
  sausage:["Smoked sausage","g",aM,"meat","#B5573F"],
  salmon:["Salmon fillets","g",aM,"fish","#F08F72"],
  shrimp:["Shrimp","g",aM,"fish","#F2A28A"],
  tuna:["Canned tuna","g",aK,"fish","#E5A98C"],
  egg:["Eggs","pcs",aD,"egg","#F2D45E"],
  milk:["Milk","ml",aD,"dairy","#F4F1E6"],
  cream:["Cooking cream","ml",aD,"dairy","#F1ECD8"],
  yoghurt:["Greek yoghurt","g",aD,"dairy","#F4F0E4"],
  butter:["Butter","g",aD,"dairy","#F2DE8A"],
  parmesan:["Parmesan","g",aD,"dairy","#EAD59A"],
  cheese:["Grated cheese","g",aD,"dairy","#EFC357"],
  feta:["Feta","g",aD,"dairy","#F3EFE0"],
  mozzarella:["Mozzarella","g",aD,"dairy","#F4F1E3"],
  halloumi:["Halloumi","g",aD,"dairy","#EEDC9C"],
  bread:["Bread","slices",aB,"gluten","#D6A862"],
  tortilla:["Tortillas","pcs",aB,"gluten","#E8D2A2"],
  pita:["Pita bread","pcs",aB,"gluten","#E4C48A"],
  oats:["Rolled oats","g",aB,"gluten","#D8C49C"],
  muesli:["Muesli","g",aB,"gluten nuts","#C89E62"],
  breadcrumbs:["Breadcrumbs","g",aB,"gluten","#D9B476"],
  pasta:["Pasta","g",aK,"gluten","#EBD18A"],
  rice:["Rice","g",aK,"","#F1EBD6"],
  risottorice:["Risotto rice","g",aK,"","#F0EAD2"],
  ricenoodles:["Rice noodles","g",aK,"","#EFE6C8"],
  quinoa:["Quinoa","g",aK,"","#D9BC7C"],
  lentils:["Red lentils","g",aK,"","#D9703A"],
  chickpeas:["Chickpeas, canned","g",aK,"","#DDB872"],
  blackbeans:["Black beans, canned","g",aK,"","#3B2F33"],
  tomatocan:["Chopped tomatoes, canned","g",aK,"","#C8392B"],
  tomatopaste:["Tomato paste","tbsp",aK,"","#B8372A"],
  coconutmilk:["Coconut milk","ml",aK,"","#F3EEDC"],
  soy:["Soy sauce","tbsp",aK,"gluten","#4A3224"],
  honey:["Honey","tbsp",aK,"animal","#E0A23A"],
  currypaste:["Red curry paste","tbsp",aK,"","#C4472E"],
  lingonberry:["Lingonberry jam","tbsp",aK,"","#A4263A"],
  olives:["Olives","g",aK,"","#5A6034"],
  stockcube:["Vegetable stock cubes","pcs",aK,"","#B9A054"],
  flour:["Wheat flour","g",aK,"gluten","#F2EBD9"],
  frozenberries:["Frozen berries","g",aF,"","#6A3C7E"],
  frozenpeas:["Frozen peas","g",aF,"","#6DB04F"],
  oil:["Olive oil","tbsp",aS,"","#C9B24A"],
  cumin:["Ground cumin","tsp",aS,"","#B07A3A"],
  paprika:["Smoked paprika","tsp",aS,"","#B8421F"],
  oregano:["Dried oregano","tsp",aS,"","#6F8A3F"],
  currypowder:["Curry powder","tsp",aS,"","#D9A32E"],
  chiliflakes:["Chili flakes","tsp",aS,"","#C0331F"],
  tacoseasoning:["Taco seasoning","tbsp",aS,"","#B5562A"]
};
export const STAPLES=Object.keys(ING).filter(function(k){return ING[k][2]===aS});

/* id, name, meals (b/l/d), minutes, tags, ingredients for 2 servings, method */
export const RAW=[
["berry-porridge","Berry oat porridge","b",10,["Light","Comfort"],[["oats",80],["milk",300],["frozenberries",100],["honey",1]],["Simmer the oats in the milk for about 5 minutes, stirring, until thick and creamy.","Warm the berries in a small pan or the microwave until they release their juice.","Spoon the porridge into bowls and top with the berries and honey."]],
["scrambled-eggs","Soft scrambled eggs on toast","b",10,["High-protein"],[["egg",4],["butter",10],["bread",4],["tomato",1]],["Whisk the eggs with a pinch of salt.","Melt the butter over low heat, add the eggs and stir slowly until just set and glossy.","Serve on toasted bread with sliced tomato and black pepper."]],
["muesli-yoghurt","Yoghurt bowl with muesli and banana","b",5,["Light"],[["yoghurt",300],["muesli",60],["banana",1],["honey",1]],["Spoon the yoghurt into two bowls.","Slice the banana on top.","Add the muesli and drizzle with honey just before eating."]],
["swedish-pancakes","Swedish pancakes with lingonberries","b",30,["Nordic","Comfort"],[["flour",100],["milk",300],["egg",2],["butter",20],["lingonberry",2]],["Whisk the flour, milk, eggs and a pinch of salt into a smooth thin batter. Rest 10 minutes.","Fry thin pancakes in a little butter, 1 to 2 minutes per side.","Serve warm with lingonberry jam."]],
["avocado-toast-egg","Avocado toast with fried egg","b",12,["Light"],[["avocado",1],["bread",4],["egg",2],["lemon",0.5],["chiliflakes",0.5],["oil",1]],["Toast the bread and mash the avocado with lemon juice and salt.","Fry the eggs in the oil until the whites are set.","Spread avocado on the toast, top with the eggs and chili flakes."]],
["shakshuka","Shakshuka","bld",25,["Mediterranean","Comfort"],[["tomatocan",400],["egg",4],["onion",1],["bellpepper",1],["garlic",2],["cumin",1],["paprika",1],["feta",50],["oil",1]],["Soften the chopped onion and pepper in the oil, then add garlic, cumin and paprika.","Add the tomatoes and simmer 10 minutes until thick.","Make four wells, crack in the eggs, cover and cook until set. Top with feta."]],
["smoothie-bowl","Berry smoothie bowl","b",5,["Light"],[["frozenberries",200],["banana",2],["yoghurt",200],["muesli",30]],["Blend the berries, one banana and the yoghurt until thick.","Pour into bowls.","Top with the other banana, sliced, and the muesli."]],
["spinach-omelette","Cheese and spinach omelette","b",10,["High-protein"],[["egg",4],["cheese",60],["spinach",60],["butter",10]],["Wilt the spinach in a hot pan with half the butter, then set aside.","Beat the eggs, melt the remaining butter and pour in the eggs.","When nearly set, add the spinach and cheese, fold and serve."]],
["greek-salad","Greek salad with pita","l",15,["Mediterranean","Light"],[["cucumber",1],["tomato",3],["redonion",1],["feta",100],["olives",50],["pita",2],["oil",2],["oregano",1]],["Chop the cucumber, tomatoes and red onion into chunky pieces.","Toss with olives, oil, oregano and a pinch of salt, then crumble over the feta.","Warm the pita in a dry pan and serve alongside."]],
["tuna-pasta-salad","Tuna pasta salad","l",20,["High-protein","Light"],[["pasta",160],["tuna",160],["cherrytomato",150],["lettuce",40],["lemon",1],["oil",2]],["Boil the pasta until tender, drain and rinse under cold water.","Halve the tomatoes and flake the tuna.","Toss everything with lemon juice, oil, salt and pepper."]],
["chickpea-wraps","Crispy chickpea wraps","l",20,["Mediterranean"],[["chickpeas",400],["tortilla",4],["yoghurt",100],["cucumber",1],["lettuce",40],["paprika",1],["cumin",1],["oil",1],["lemon",0.5]],["Drain the chickpeas and fry in the oil with paprika and cumin until crisp, about 10 minutes.","Mix the yoghurt with lemon juice and salt. Slice the cucumber.","Fill the warm tortillas with salad leaves, cucumber, chickpeas and yoghurt sauce."]],
["chicken-salad","Lemon chicken salad","l",25,["High-protein","Light"],[["chicken",250],["lettuce",100],["cherrytomato",100],["cucumber",1],["parmesan",20],["lemon",1],["oil",2],["bread",2]],["Season the chicken and fry 5 to 6 minutes per side until cooked through. Rest, then slice.","Toast and cube the bread for croutons.","Toss the leaves, tomatoes and cucumber with lemon juice and oil, then top with chicken, croutons and shaved parmesan."]],
["red-lentil-soup","Red lentil and carrot soup","ld",30,["Soup","Comfort"],[["lentils",150],["carrot",3],["onion",1],["garlic",2],["cumin",1],["stockcube",1],["lemon",0.5],["oil",1]],["Soften the chopped onion and carrot in the oil, then add garlic and cumin.","Add the lentils, stock cube and about 800 ml water. Simmer 20 minutes.","Blend until smooth, season and finish with a squeeze of lemon."]],
["halloumi-bowl","Halloumi and quinoa bowl","ld",25,["Mediterranean","Bowl","High-protein"],[["halloumi",150],["quinoa",120],["cucumber",1],["cherrytomato",150],["avocado",1],["lemon",1],["oil",1]],["Cook the quinoa in salted water for 12 to 15 minutes and drain.","Fry the sliced halloumi in a dry pan until golden on both sides.","Build bowls with quinoa, chopped vegetables, avocado and halloumi, dressed with lemon juice and oil."]],
["egg-fried-rice","Egg fried rice with peas","ld",20,["Asian","Comfort"],[["rice",150],["egg",3],["frozenpeas",100],["scallion",3],["soy",2],["garlic",2],["ginger",10],["oil",2]],["Cook the rice and let it cool a little, or use leftover rice.","Fry garlic and ginger in hot oil, add the peas and rice and stir-fry 3 minutes.","Push to the side, scramble the eggs, then mix in the soy sauce and sliced spring onions."]],
["cheese-toastie","Tomato and cheese toastie","l",10,["Comfort"],[["bread",4],["cheese",120],["tomato",2],["butter",15]],["Butter the outside of the bread and layer cheese and sliced tomato inside.","Fry in a pan over medium heat until golden.","Flip once, press down and cook until the cheese melts."]],
["shrimp-avocado-salad","Shrimp and avocado salad","l",15,["Light","High-protein"],[["shrimp",200],["avocado",1],["lettuce",80],["cucumber",1],["lime",1],["oil",1],["chili",1]],["Fry the shrimp in the oil with sliced chili for 2 to 3 minutes until pink.","Slice the avocado and cucumber over the salad leaves.","Add the shrimp and dress with lime juice and a pinch of salt."]],
["bean-quesadillas","Black bean quesadillas","ld",20,["Mexican"],[["tortilla",4],["blackbeans",240],["cheese",120],["bellpepper",1],["onion",1],["cumin",1],["coriander",10]],["Fry diced onion and pepper with the cumin until soft, then stir in the drained beans.","Spread over two tortillas, scatter with cheese and coriander and top with the other two.","Fry each quesadilla 2 to 3 minutes per side until crisp, then cut into wedges."]],
["carbonara","Spaghetti carbonara","d",25,["Italian","Comfort"],[["pasta",200],["bacon",100],["egg",2],["parmesan",40],["garlic",1]],["Boil the pasta in salted water and save a cup of the cooking water.","Fry the bacon with the garlic until crisp. Whisk the eggs with the parmesan and plenty of pepper.","Toss the hot pasta with the bacon off the heat, stir in the egg mix and loosen with pasta water."]],
["tomato-basil-pasta","Spaghetti with tomato and basil","d",20,["Italian"],[["pasta",200],["tomatocan",400],["garlic",3],["basil",10],["oil",2],["parmesan",30]],["Gently fry the sliced garlic in the oil, add the tomatoes and simmer 12 minutes.","Boil the pasta until al dente.","Toss with the sauce, torn basil and grated parmesan."]],
["creamy-chicken-pasta","Creamy chicken and mushroom pasta","d",30,["Italian","Comfort","High-protein"],[["pasta",200],["chicken",250],["mushroom",200],["cream",200],["garlic",2],["onion",1],["parmesan",30]],["Cook the pasta. Fry the sliced chicken until golden and set aside.","Fry the onion and mushrooms, add garlic, then pour in the cream and simmer 5 minutes.","Return the chicken, add the pasta and parmesan, and loosen with a little cooking water."]],
["swedish-meatballs","Swedish meatballs with potatoes","d",45,["Nordic","Comfort"],[["beefmince",400],["breadcrumbs",40],["milk",60],["egg",1],["onion",1],["butter",30],["cream",150],["potato",600],["lingonberry",4]],["Soak the breadcrumbs in the milk. Mix with the mince, egg, grated onion and salt, then roll into small balls.","Boil the potatoes. Fry the meatballs in butter until browned and cooked through.","Pour the cream into the pan for a quick gravy and serve with the potatoes and lingonberry jam."]],
["salmon-dill-potatoes","Baked salmon with dill potatoes","d",35,["Nordic","High-protein"],[["salmon",300],["potato",500],["dill",15],["lemon",1],["yoghurt",100],["oil",1],["cucumber",1]],["Boil the potatoes until tender and heat the oven to 200 °C.","Bake the salmon with the oil and salt for 12 to 15 minutes.","Toss the potatoes with chopped dill and serve with lemon, cucumber and a spoon of yoghurt."]],
["pytt-i-panna","Pytt i panna","d",30,["Nordic","Comfort"],[["potato",500],["sausage",200],["onion",1],["egg",2],["butter",20]],["Dice the potatoes small and fry in butter until golden, about 10 minutes.","Add the diced sausage and onion and fry until crisp.","Top with fried eggs and serve with pepper."]],
["chicken-curry","Coconut chicken curry","d",30,["Asian","Comfort"],[["chicken",300],["coconutmilk",400],["currypaste",2],["onion",1],["garlic",2],["ginger",10],["rice",160],["spinach",60],["lime",1]],["Start the rice. Fry the onion, garlic and ginger, then stir in the curry paste for a minute.","Add the sliced chicken and coconut milk and simmer 12 to 15 minutes.","Stir in the spinach until wilted and finish with lime juice. Serve over the rice."]],
["chicken-noodle-stir-fry","Chicken stir-fry with noodles","d",25,["Asian","High-protein"],[["chicken",250],["ricenoodles",150],["broccoli",200],["carrot",2],["soy",3],["garlic",2],["ginger",10],["oil",2],["scallion",2]],["Soak the noodles as the packet says. Slice the chicken, carrots and broccoli.","Stir-fry the chicken in hot oil until golden, then add the vegetables, garlic and ginger.","Add the noodles and soy sauce, toss until hot and top with spring onions."]],
["chickpea-spinach-curry","Chickpea and spinach curry","d",30,["Asian","Comfort"],[["chickpeas",400],["tomatocan",400],["onion",1],["garlic",2],["ginger",10],["spinach",100],["currypowder",2],["rice",160],["oil",1]],["Start the rice. Soften the onion in the oil, then add garlic, ginger and curry powder.","Add the tomatoes and chickpeas and simmer for 15 minutes.","Stir in the spinach until wilted and serve over the rice."]],
["veggie-chili","Smoky bean chili","d",35,["Mexican","Comfort"],[["blackbeans",400],["tomatocan",400],["onion",1],["bellpepper",2],["garlic",2],["cumin",2],["paprika",1],["rice",160],["lime",1],["oil",1]],["Start the rice. Fry the onion and peppers in the oil, then add garlic and spices.","Add the beans and tomatoes and simmer for 20 minutes until thick.","Serve over the rice with a squeeze of lime."]],
["beef-tacos","Beef tacos","d",25,["Mexican"],[["beefmince",300],["tortilla",6],["cheese",80],["lettuce",60],["tomato",2],["avocado",1],["onion",1],["tacoseasoning",2]],["Fry the chopped onion, add the mince and brown well. Stir in the taco seasoning and a splash of water.","Chop the tomatoes and lettuce and slice the avocado.","Warm the tortillas and fill with beef, vegetables and cheese."]],
["burrito-bowl","Chicken burrito bowl","d",30,["Mexican","Bowl","High-protein"],[["chicken",300],["rice",160],["blackbeans",240],["avocado",1],["tomato",2],["lime",1],["cumin",1],["paprika",1],["coriander",10]],["Cook the rice. Rub the chicken with cumin, paprika and salt, fry until cooked through and slice.","Warm the beans and chop the tomatoes and avocado.","Fill bowls with rice, beans, chicken and vegetables. Finish with coriander and lime."]],
["sweet-potato-chickpeas","Roasted sweet potato with chickpeas and feta","d",40,["Mediterranean","Bowl"],[["sweetpotato",600],["chickpeas",240],["feta",100],["redonion",1],["oil",2],["cumin",1],["yoghurt",100],["lemon",0.5]],["Heat the oven to 220 °C. Roast cubed sweet potato, chickpeas and red onion with the oil and cumin for 30 minutes.","Stir the yoghurt with lemon juice and salt.","Serve the roasted vegetables with crumbled feta and the yoghurt sauce."]],
["pita-pizzas","Pita pizzas","d",20,["Italian","Comfort"],[["pita",4],["tomatopaste",3],["mozzarella",200],["basil",10],["oil",1]],["Heat the oven to 225 °C and spread each pita with tomato paste.","Top with torn mozzarella and a drizzle of oil.","Bake 8 to 10 minutes until bubbling and finish with basil."]],
["teriyaki-salmon","Teriyaki salmon with rice and broccoli","d",25,["Asian","High-protein"],[["salmon",300],["rice",160],["broccoli",250],["soy",3],["honey",2],["ginger",10],["garlic",1],["oil",1]],["Start the rice. Mix the soy sauce, honey, grated ginger and garlic.","Fry the salmon in the oil, skin side down first, then pour in the glaze for the last 2 minutes.","Steam or boil the broccoli and serve everything over the rice."]],
["garlic-shrimp-pasta","Garlic and lemon shrimp pasta","d",25,["Italian","Light"],[["pasta",200],["shrimp",250],["garlic",3],["lemon",1],["parsley",10],["oil",2],["chili",1],["cherrytomato",150]],["Boil the pasta. Fry garlic and sliced chili in the oil, then add the halved tomatoes.","Add the shrimp and cook until pink, 2 to 3 minutes.","Toss with the pasta, lemon zest and juice and chopped parsley."]],
["mushroom-risotto","Mushroom risotto","d",40,["Italian","Comfort"],[["risottorice",160],["mushroom",250],["onion",1],["garlic",2],["stockcube",1],["parmesan",50],["butter",20]],["Fry the mushrooms in the butter until golden and set aside. Dissolve the stock cube in about 600 ml hot water.","Soften the onion and garlic, add the rice and stir for a minute, then add stock a ladle at a time for about 20 minutes.","Fold in the mushrooms and parmesan and season."]],
["chicken-souvlaki","Chicken souvlaki with tzatziki","d",30,["Mediterranean","High-protein"],[["chicken",300],["pita",4],["yoghurt",150],["cucumber",1],["garlic",2],["lemon",1],["oregano",2],["tomato",2],["redonion",1],["oil",1]],["Marinate the sliced chicken in lemon juice, oregano, oil and one garlic clove, then fry until golden.","Grate the cucumber, squeeze out the water and mix with the yoghurt, the other garlic clove and salt.","Warm the pita and fill with chicken, tomato, onion and tzatziki."]]
];

export const MEALS={b:'breakfast',l:'lunch',d:'dinner'};
export const MEAL_LABEL={breakfast:'Breakfast',lunch:'Lunch',dinner:'Dinner'};
export const MEAL_ORDER=['breakfast','lunch','dinner'];
export const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export const DAYS_LONG=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export const TAGS=['All','Mine','Friends','Low effort','Quick','High-protein','Light','Comfort','Italian','Asian','Mexican','Nordic','Mediterranean','Soup','Bowl'];
export const DIETS=['Vegetarian','Vegan','Pescatarian','Gluten-free','Dairy-free','Nut-free'];

/* Units offered in the recipe editor: [label, stored unit, factor to stored unit]. */
export const UNITS=[['g','g',1],['kg','g',1000],['ml','ml',1],['dl','ml',100],['l','ml',1000],['pcs','pcs',1],['tbsp','tbsp',1],['tsp','tsp',1]];
/* Plate colour for ingredients the catalogue doesn't know, by store section. */
export const AISLE_COLOUR={"Produce":"#7CB35A","Meat & fish":"#C4604A","Dairy & eggs":"#F2DE8A","Bakery & cereals":"#D6A862","Pantry":"#D9A32E","Frozen":"#6DB04F","Basics":"#B9A054"};
