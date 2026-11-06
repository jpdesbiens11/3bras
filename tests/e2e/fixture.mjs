// Petit livre de test (recettes inventées pour les tests, aucune donnée personnelle).
const r = (id, Nom, Type, Statut, Protéine, temps, ing, eta, extra = {}) => ({
  id, Nom, Type, Statut, 'Protéine': Protéine, 'Temps total (min)': temps, Portions: 4, 'Soir de semaine': temps <= 45,
  'Fiche complète': true, Ingrédients: ing, Étapes: eta, 'Tâches sous-chef': ['Rincer les légumes', 'Mesurer les épices'], ...extra
});
export const LIVRE = {
  format: '3ebras-import', version: 1, schema: 2, genere_le: '2026-11-06', source: 'tests',
  recettes: [
    r('r-pate', 'Pâté chinois test', 'Souper', 'Au livre', 'Bœuf', 50, ['500 g de bœuf haché', '1 oignon haché', '1 boîte de maïs en crème', '6 pommes de terre'], ['Faire revenir le bœuf et l\'oignon 8 minutes.', 'Étaler le maïs.', 'Couvrir de purée et cuire au four 25 minutes.'], { 'Jour fixe': '' }),
    r('r-poulet', 'Poulet au citron test', 'Souper', 'Au livre', 'Poulet', 35, ['## Marinade', '2 c. à soupe d\'huile d\'olive', '1 citron', '## Plat', '4 hauts de cuisse de poulet', '1 tasse de riz'], ['Mélanger la marinade.', 'Cuire le poulet 20 minutes.', 'Servir avec le riz.']),
    r('r-saumon', 'Saumon érable test', 'Souper', 'À trier', 'Poisson & fruits de mer', 25, ['4 filets de saumon', '3 c. à soupe de sirop d\'érable', '2 c. à soupe de sauce soya'], ['Mélanger le sirop et la soya.', 'Cuire au four 12 minutes.']),
    r('r-tofu', 'Tofu croustillant test', 'Souper', 'À trier', 'Végé', 30, ['1 bloc de tofu ferme', '2 c. à soupe de fécule de maïs', '1 poivron rouge'], ['Couper le tofu en cubes.', 'Cuire à l\'air fryer 15 minutes.']),
    r('r-porc', 'Porc souvlaki test', 'Souper', 'Au livre', 'Porc', 40, ['600 g de porc en cubes', '1 citron', '1 c. à thé d\'origan'], ['Mariner le porc.', 'Griller 10 minutes.']),
    r('r-pates', 'Pâtes rosées test', 'Souper', 'À trier', 'Végé', 20, ['350 g de penne', '1 tasse de sauce tomate', '1/2 tasse de crème 15 %'], ['Cuire les pâtes 11 minutes.', 'Mélanger avec la sauce.']),
    r('r-vieux', 'Vieux ragoût test', 'Souper', 'Déclassée', 'Bœuf', 120, ['1 kg de bœuf'], ['Mijoter 2 heures.']),
    r('r-pouding', 'Pouding aux pommes test', 'Dessert', 'À trier', '', 30, ['3 pommes', '1/2 tasse de cassonade'], ['Couper les pommes.', 'Cuire 18 minutes.']),
    r('r-vide', 'Photo de recette test', 'Souper', 'À trier', '', '', [], [], { 'Fiche complète': false })
  ],
  plans: [],
  inventaire: [
    { id: 'i-ail', Nom: 'Ail', Zone: 'Garde-manger', 'Département': 'Fruits et légumes', 'Quantité': 1, Essentiel: true },
    { id: 'i-citron', Nom: 'Citron', Zone: 'Frigo', 'Département': 'Fruits et légumes', 'Quantité': 0 },
    { id: 'i-huile', Nom: 'Huile d\'olive', Zone: 'Garde-manger', 'Département': 'Épicerie sèche', 'Quantité': 1, Essentiel: true }
  ],
  bilans: []
};
