class DifferentialPrivacyManager {
  constructor(epsilon = 1.0, delta = 0.001) {
    this.epsilon = epsilon; // Privacy budget
    this.delta = delta; // Probability of privacy breach
    this.sensitivity = 1.0; // Global sensitivity
    this.wordClusteringManager = null;
  }

  setWordClusteringManager(manager) {
    this.wordClusteringManager = manager;
  }

  // Main method to get privacy-preserving word replacement
  getPrivateReplacement(sensitiveWord, context = null) {
    if (!this.wordClusteringManager) {
      throw new Error("Word clustering manager not initialized");
    }

    const cluster = this.wordClusteringManager.findWordCluster(sensitiveWord);

    if (!cluster || cluster.length === 0) {
      // If no cluster found, return censored version
      return this.censorWord(sensitiveWord);
    }

    // Apply differential privacy mechanism
    return this.exponentialMechanism(sensitiveWord, cluster, context);
  }

  // Exponential mechanism for selecting replacement word
  exponentialMechanism(originalWord, candidates, context) {
    // Calculate utility scores for each candidate
    const utilities = candidates.map((candidate) =>
      this.calculateUtility(originalWord, candidate, context)
    );

    // Apply exponential mechanism
    const probabilities = this.computeExponentialProbabilities(utilities);

    // Sample from the probability distribution
    return this.sampleFromDistribution(candidates, probabilities);
  }

  // Calculate utility score for a replacement candidate
  calculateUtility(original, candidate, context) {
    let utility = 0;

    // Semantic similarity (higher is better)
    const semanticSimilarity = this.wordClusteringManager.computeSimilarity(
      original,
      candidate
    );
    utility += semanticSimilarity * 0.4;

    // Length similarity (closer length is better)
    const lengthDifference = Math.abs(original.length - candidate.length);
    const lengthSimilarity = 1 / (1 + lengthDifference);
    utility += lengthSimilarity * 0.3;

    // Contextual appropriateness (if context is provided)
    if (context) {
      const contextualScore = this.calculateContextualScore(candidate, context);
      utility += contextualScore * 0.2;
    }

    // Randomness to prevent deterministic selection
    utility += Math.random() * 0.1;

    return utility;
  }

  // Calculate how well a word fits the given context
  calculateContextualScore(word, context) {
    // Simple context matching based on common words
    const contextWords = context.toLowerCase().split(/\s+/);
    const wordLower = word.toLowerCase();

    // Check if word appears in context (lower score to avoid repetition)
    if (contextWords.includes(wordLower)) {
      return 0.2;
    }

    // Check for thematic consistency
    const themes = {
      professional: ["business", "office", "work", "company", "meeting"],
      personal: ["family", "home", "personal", "private", "friend"],
      technical: ["system", "software", "code", "program", "data"],
      medical: ["health", "doctor", "hospital", "medical", "patient"],
    };

    let maxThemeScore = 0;
    for (const [theme, keywords] of Object.entries(themes)) {
      const contextScore = keywords.some((keyword) =>
        contextWords.some((contextWord) => contextWord.includes(keyword))
      )
        ? 1
        : 0;

      const wordScore = this.getWordThemeScore(wordLower, theme);
      maxThemeScore = Math.max(maxThemeScore, contextScore * wordScore);
    }

    return maxThemeScore;
  }

  // Get thematic score for a word
  getWordThemeScore(word, theme) {
    const themeWords = {
      professional: [
        "manager",
        "director",
        "analyst",
        "consultant",
        "executive",
      ],
      personal: ["friend", "family", "parent", "child", "spouse"],
      technical: [
        "developer",
        "engineer",
        "programmer",
        "architect",
        "specialist",
      ],
      medical: ["doctor", "nurse", "surgeon", "therapist", "physician"],
    };

    return themeWords[theme] && themeWords[theme].includes(word) ? 1 : 0;
  }

  // Compute probabilities using exponential mechanism
  computeExponentialProbabilities(utilities) {
    const scaledUtilities = utilities.map((u) =>
      Math.exp((this.epsilon * u) / (2 * this.sensitivity))
    );

    const sum = scaledUtilities.reduce((acc, val) => acc + val, 0);
    return scaledUtilities.map((u) => u / sum);
  }

  // Sample from probability distribution
  sampleFromDistribution(candidates, probabilities) {
    const random = Math.random();
    let cumulativeProbability = 0;

    for (let i = 0; i < candidates.length; i++) {
      cumulativeProbability += probabilities[i];
      if (random <= cumulativeProbability) {
        return candidates[i];
      }
    }

    // Fallback to last candidate
    return candidates[candidates.length - 1];
  }

  // Laplace mechanism for numerical privacy
  laplaceMechanism(trueValue, sensitivity = this.sensitivity) {
    const scale = sensitivity / this.epsilon;
    const noise = this.sampleLaplace(scale);
    return trueValue + noise;
  }

  // Sample from Laplace distribution
  sampleLaplace(scale) {
    const u = Math.random() - 0.5;
    return scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  // Gaussian mechanism for numerical privacy
  gaussianMechanism(trueValue, sensitivity = this.sensitivity) {
    const sigma =
      (Math.sqrt(2 * Math.log(1.25 / this.delta)) * sensitivity) / this.epsilon;
    const noise = this.sampleGaussian(0, sigma);
    return trueValue + noise;
  }

  // Sample from Gaussian distribution (Box-Muller transform)
  sampleGaussian(mean, stddev) {
    let u1 = Math.random();
    let u2 = Math.random();

    // Ensure u1 is not 0 to avoid log(0)
    while (u1 === 0) {
      u1 = Math.random();
    }

    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + stddev * z0;
  }

  // Censor word with asterisks
  censorWord(word) {
    return "*".repeat(word.length);
  }

  // Privacy budget management
  updatePrivacyBudget(usedEpsilon) {
    this.epsilon = Math.max(0, this.epsilon - usedEpsilon);

    if (this.epsilon <= 0) {
      console.warn(
        "Privacy budget exhausted. Consider resetting or using stricter privacy parameters."
      );
    }
  }

  // Reset privacy budget
  resetPrivacyBudget(newEpsilon = 1.0) {
    this.epsilon = newEpsilon;
  }

  // Get current privacy budget
  getPrivacyBudget() {
    return {
      epsilon: this.epsilon,
      delta: this.delta,
      remaining: this.epsilon,
    };
  }

  // Compose privacy parameters for multiple queries
  composePrivacyParameters(queries) {
    // Basic composition (sum of epsilons)
    const totalEpsilon = queries.reduce((sum, query) => sum + query.epsilon, 0);
    const maxDelta = Math.max(...queries.map((query) => query.delta));

    return {
      epsilon: totalEpsilon,
      delta: maxDelta,
      compositionType: "basic",
    };
  }

  // Advanced composition with better privacy bounds
  advancedComposition(queries, delta_prime = 0.001) {
    const k = queries.length;
    const maxEpsilon = Math.max(...queries.map((q) => q.epsilon));

    // Advanced composition theorem
    const epsilonAdvanced =
      Math.sqrt(2 * k * Math.log(1 / delta_prime)) * maxEpsilon +
      k * maxEpsilon * (Math.exp(maxEpsilon) - 1);

    return {
      epsilon: epsilonAdvanced,
      delta: this.delta + delta_prime,
      compositionType: "advanced",
    };
  }

  // Privacy analysis report
  getPrivacyReport() {
    return {
      mechanism: "Exponential Mechanism",
      epsilon: this.epsilon,
      delta: this.delta,
      sensitivity: this.sensitivity,
      privacyGuarantee: `(${this.epsilon}, ${this.delta})-differential privacy`,
      description:
        "Provides formal privacy guarantees for word replacement while maintaining utility",
    };
  }
}

// Export for use in content script
if (typeof module !== "undefined" && module.exports) {
  module.exports = DifferentialPrivacyManager;
}
