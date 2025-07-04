class WordClusteringManager {
  constructor() {
    this.clusters = new Map();
    this.wordEmbeddings = new Map();
    this.initializeClusters();
  }

  async initializeClusters() {
    // Load pre-computed word clusters from storage or generate them
    const storedClusters = await this.loadClustersFromStorage();
    if (storedClusters) {
      this.clusters = new Map(storedClusters);
    } else {
      await this.generateDefaultClusters();
      this.saveClustersToStorage();
    }
  }

  async loadClustersFromStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["wordClusters"], (result) => {
        resolve(result.wordClusters || null);
      });
    });
  }

  async saveClustersToStorage() {
    const clustersArray = Array.from(this.clusters.entries());
    chrome.storage.local.set({ wordClusters: clustersArray });
  }

  async generateDefaultClusters() {
    // Default semantic clusters for common word categories
    const defaultClusters = {
      countries: [
        "Canada",
        "America",
        "Mexico",
        "France",
        "Germany",
        "Italy",
        "Spain",
        "Brazil",
        "Argentina",
        "Japan",
        "China",
        "India",
        "Australia",
        "Russia",
      ],
      body_parts: [
        "Hand",
        "Eyes",
        "Feet",
        "Head",
        "Arm",
        "Leg",
        "Shoulder",
        "Knee",
        "Elbow",
        "Finger",
        "Toe",
        "Chest",
        "Back",
        "Neck",
      ],
      colors: [
        "Red",
        "Blue",
        "Green",
        "Yellow",
        "Purple",
        "Orange",
        "Pink",
        "Brown",
        "Black",
        "White",
        "Gray",
        "Cyan",
        "Magenta",
        "Lime",
      ],
      animals: [
        "Dog",
        "Cat",
        "Bird",
        "Fish",
        "Horse",
        "Cow",
        "Pig",
        "Sheep",
        "Lion",
        "Tiger",
        "Bear",
        "Wolf",
        "Fox",
        "Rabbit",
      ],
      professions: [
        "Doctor",
        "Teacher",
        "Engineer",
        "Lawyer",
        "Nurse",
        "Police",
        "Firefighter",
        "Chef",
        "Artist",
        "Writer",
        "Scientist",
        "Manager",
      ],
      cities: [
        "New York",
        "London",
        "Paris",
        "Tokyo",
        "Berlin",
        "Madrid",
        "Rome",
        "Beijing",
        "Sydney",
        "Moscow",
        "Toronto",
        "Chicago",
      ],
      emotions: [
        "Happy",
        "Sad",
        "Angry",
        "Excited",
        "Calm",
        "Nervous",
        "Proud",
        "Disappointed",
        "Grateful",
        "Confused",
        "Surprised",
        "Content",
      ],
      food: [
        "Pizza",
        "Burger",
        "Pasta",
        "Sushi",
        "Salad",
        "Sandwich",
        "Soup",
        "Steak",
        "Chicken",
        "Fish",
        "Bread",
        "Rice",
      ],
    };

    // Create reverse mapping for quick lookup
    for (const [category, words] of Object.entries(defaultClusters)) {
      for (const word of words) {
        this.clusters.set(word.toLowerCase(), {
          category,
          alternatives: words.filter(
            (w) => w.toLowerCase() !== word.toLowerCase()
          ),
        });
      }
    }
  }

  findWordCluster(word) {
    const normalizedWord = word.toLowerCase();
    const cluster = this.clusters.get(normalizedWord);

    if (cluster) {
      return cluster.alternatives;
    }

    // If not found in predefined clusters, try to find similar words
    return this.findSimilarWords(word);
  }

  findSimilarWords(word) {
    // Simple similarity based on word length and first letter
    // In a real implementation, this would use proper word embeddings
    const similarWords = [];
    const targetLength = word.length;
    const firstLetter = word[0].toLowerCase();

    for (const [clusterWord, cluster] of this.clusters.entries()) {
      if (
        clusterWord[0].toLowerCase() === firstLetter &&
        Math.abs(clusterWord.length - targetLength) <= 2
      ) {
        similarWords.push(...cluster.alternatives.slice(0, 3));
      }
    }

    return similarWords.slice(0, 5); // Return top 5 similar words
  }

  // Compute semantic similarity using cosine similarity
  computeSimilarity(word1, word2) {
    // Placeholder for actual embedding-based similarity
    // This would use pre-trained word embeddings or sentence transformers
    const embedding1 = this.getWordEmbedding(word1);
    const embedding2 = this.getWordEmbedding(word2);

    if (!embedding1 || !embedding2) {
      return this.simpleSimilarity(word1, word2);
    }

    return this.cosineSimilarity(embedding1, embedding2);
  }

  getWordEmbedding(word) {
    // Placeholder for word embedding retrieval
    // In production, this would load from pre-computed embeddings
    return this.wordEmbeddings.get(word.toLowerCase()) || null;
  }

  simpleSimilarity(word1, word2) {
    // Simple string similarity as fallback
    const longer = word1.length > word2.length ? word1 : word2;
    const shorter = word1.length > word2.length ? word2 : word1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Add new word to existing cluster or create new cluster
  addWordToCluster(word, category) {
    const normalizedWord = word.toLowerCase();

    if (this.clusters.has(normalizedWord)) {
      return; // Word already exists
    }

    // Find existing cluster for this category
    const existingCluster = Array.from(this.clusters.entries()).find(
      ([, cluster]) => cluster.category === category
    );

    if (existingCluster) {
      const [, cluster] = existingCluster;
      cluster.alternatives.push(word);

      // Update all words in this cluster
      for (const [clusterWord, clusterData] of this.clusters.entries()) {
        if (clusterData.category === category) {
          clusterData.alternatives = cluster.alternatives.filter(
            (w) => w.toLowerCase() !== clusterWord
          );
        }
      }
    }

    this.clusters.set(normalizedWord, {
      category,
      alternatives: existingCluster ? existingCluster[1].alternatives : [],
    });

    this.saveClustersToStorage();
  }

  // Get cluster statistics
  getClusterStats() {
    const stats = {};

    for (const [, cluster] of this.clusters.entries()) {
      if (!stats[cluster.category]) {
        stats[cluster.category] = 0;
      }
      stats[cluster.category]++;
    }

    return stats;
  }
}

// Export for use in content script
if (typeof module !== "undefined" && module.exports) {
  module.exports = WordClusteringManager;
}
