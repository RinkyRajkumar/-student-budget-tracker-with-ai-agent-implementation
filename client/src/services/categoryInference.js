const rules = [
  {
    category: "Subscriptions",
    words: ["spotify", "netflix", "prime", "subscription", "monthly plan", "plan", "youtube", "hotstar", "app"]
  },
  {
    category: "Food",
    words: ["lunch", "dinner", "breakfast", "coffee", "snack", "burger", "burgers", "pizza", "dal", "chawal", "canteen", "zomato", "swiggy"]
  },
  {
    category: "Transport",
    words: ["uber", "ola", "cab", "taxi", "bus", "metro", "train", "fuel", "auto", "ride"]
  },
  {
    category: "Books",
    words: ["book", "textbook", "notebook", "course", "lab", "library", "print", "stationery"]
  },
  {
    category: "Entertainment",
    words: ["movie", "game", "games", "concert", "party", "outing", "cinema"]
  },
  {
    category: "Shopping",
    words: ["amazon", "flipkart", "clothes", "shoes", "dorm", "supplies", "shopping"]
  },
  {
    category: "Health",
    words: ["pharmacy", "medicine", "doctor", "clinic", "health"]
  },
  {
    category: "Rent",
    words: ["rent", "hostel", "room"]
  },
  {
    category: "Tuition",
    words: ["tuition", "fees", "semester", "college fee"]
  }
];

export function inferCategoryFromNote(note, categories) {
  const normalized = String(note || "").toLowerCase();
  if (!normalized.trim()) return null;
  const match = rules.find((rule) => rule.words.some((word) => normalized.includes(word)));
  if (!match) return null;
  return categories.find((category) => category.name === match.category) || null;
}
