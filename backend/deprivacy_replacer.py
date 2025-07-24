import os
import json
import numpy as np
from scipy.spatial.distance import cdist, pdist
from rapidfuzz import fuzz


class DeprivacyReplacer:
    def __init__(
        self,
        clusters_file="clustering/clusters/embeddings_clusters.json",
        embeddings_file="embeddings/pii_entities_crawl-300d-2M.vec",
        epsilon=1.0,
        distance_metric="euclidean",
        dp_type="metric",
        K=1,
    ):
        self.clusters_file = clusters_file
        self.embeddings_file = embeddings_file
        self.epsilon = epsilon
        self.distance_metric = distance_metric
        self.dp_type = dp_type
        self.K = K
        
        # Load embeddings and clusters
        self.embeddings = self.load_embeddings()
        self.clusters = self.load_clusters()
        
        # Calculate distances and sensitivities
        self.inter_distances, self.inter_cluster_sensitivity = self.calculate_inter_cluster_distances()
        self.intra_cluster_sensitivity = self.calculate_intra_cluster_distances()

    def load_embeddings(self):
        """Load embeddings from the PII entities file"""
        embeddings = {}
        
        if not os.path.exists(self.embeddings_file):
            print(f"Warning: Embeddings file {self.embeddings_file} not found")
            return embeddings
            
        print("Loading embeddings...")
        with open(self.embeddings_file, 'r', encoding='utf-8') as f:
            first_line = next(f).strip().split()
            if len(first_line) == 2:
                # Skip header line if it contains vocab size and dimensions
                pass
            else:
                # First line is actually a word embedding
                word = first_line[0]
                vector = np.array([float(x) for x in first_line[1:]])
                embeddings[word] = vector
            
            for line in f:
                parts = line.strip().split()
                if len(parts) > 1:
                    word = parts[0]
                    vector = np.array([float(x) for x in parts[1:]])
                    embeddings[word] = vector
        
        print(f"Loaded {len(embeddings)} word embeddings")
        return embeddings

    def load_clusters(self):
        """Load clusters from JSON file"""
        if not os.path.exists(self.clusters_file):
            print(f"Warning: Clusters file {self.clusters_file} not found")
            return {}
            
        with open(self.clusters_file, "r") as f:
            data = json.load(f)
        
        # Convert string keys to integers
        clusters = {int(k): v for k, v in data.items()}
        print(f"Loaded {len(clusters)} clusters")
        return clusters

    def find_word_cluster(self, word):
        """Find which cluster a word belongs to"""
        word_lower = word.lower()
        for label, words in self.clusters.items():
            if word_lower in words:
                return label
        return None

    def exponential_mechanism(self, utilities, sensitivity):
        """Apply exponential mechanism for differential privacy"""
        if sensitivity == 0:
            # If sensitivity is 0, return uniform probabilities
            return np.ones(len(utilities)) / len(utilities)
            
        probabilities = np.exp(self.epsilon * np.array(utilities) / (2 * sensitivity))
        probabilities /= np.sum(probabilities)
        return probabilities

    def calculate_inter_cluster_distances(self):
        """Calculate distances between cluster centroids"""
        if not self.clusters or not self.embeddings:
            return np.array([]), 1.0
            
        centroids = {}
        
        # Calculate centroids of each cluster
        for label, words in self.clusters.items():
            valid_embeddings = []
            for word in words:
                if word in self.embeddings:
                    valid_embeddings.append(self.embeddings[word])
            
            if valid_embeddings:
                centroids[label] = self.K * np.mean(valid_embeddings, axis=0)
            else:
                # If no valid embeddings, use zero vector
                if self.embeddings:
                    embedding_dim = next(iter(self.embeddings.values())).shape[0]
                    centroids[label] = np.zeros(embedding_dim)

        if not centroids:
            return np.array([]), 1.0

        # Compute pairwise distances between centroids
        centroid_vectors = [centroids[label] for label in sorted(centroids.keys())]
        inter_cluster_distances = cdist(
            centroid_vectors,
            centroid_vectors,
            metric=self.distance_metric,
        )

        inter_cluster_sensitivity = (
            np.max(inter_cluster_distances) if self.dp_type == "standard" else 1.0
        )

        return inter_cluster_distances, inter_cluster_sensitivity

    def calculate_intra_cluster_distances(self):
        """Calculate maximum intra-cluster distances for each cluster"""
        intra_cluster_sensitivity = {}
        
        for label, words in self.clusters.items():
            valid_embeddings = []
            for word in words:
                if word in self.embeddings:
                    valid_embeddings.append(self.embeddings[word])
            
            if len(valid_embeddings) > 1:
                distances = pdist(valid_embeddings, metric=self.distance_metric)
                max_distance = max(distances) if len(distances) > 0 else 1.0
            else:
                max_distance = 1.0  # Default sensitivity for single-word clusters
                
            intra_cluster_sensitivity[label] = max_distance

        return intra_cluster_sensitivity

    def is_clean_suggestion(self, candidate, query, similarity_threshold=90):
        """Check if candidate word is clean (not a typo/variation of query)"""
        similarity = fuzz.partial_ratio(candidate, query)
        return similarity < similarity_threshold

    def replace_word(self, target_word):
        """
        Replace a word using differential privacy with cluster-based approach
        
        Args:
            target_word (str): The word to replace
            
        Returns:
            tuple: (replacement_word, target_cluster_id, selected_cluster_id) or (None, None, None) if word not found
        """
        target_word_lower = target_word.lower()
        target_cluster_label = self.find_word_cluster(target_word_lower)

        if target_cluster_label is None:
            return None, None, None

        # If only one cluster or simple mechanism, use the target cluster
        if len(self.clusters) == 1:
            selected_cluster_label = target_cluster_label
        else:
            # Stage 1: Select cluster using exponential mechanism
            distances_from_cluster = [
                -self.inter_distances[target_cluster_label][i]
                for i in range(len(self.clusters))
            ]
            probabilities = self.exponential_mechanism(
                distances_from_cluster, self.inter_cluster_sensitivity
            )
            selected_cluster_label = np.random.choice(
                list(self.clusters.keys()), p=probabilities
            )

        # Stage 2: Select word from chosen cluster
        selected_cluster_words = self.clusters[selected_cluster_label]
        
        # Filter to only words that exist in embeddings
        valid_words = [word for word in selected_cluster_words if word in self.embeddings]
        
        if not valid_words:
            return None, target_cluster_label, selected_cluster_label

        # If target word has no embedding, return random word from cluster
        if target_word_lower not in self.embeddings:
            selected_word = np.random.choice(valid_words)
            return selected_word, target_cluster_label, selected_cluster_label

        # Calculate distances from target word to all valid words in selected cluster
        target_word_embedding = np.array(self.embeddings[target_word_lower]).reshape(1, -1)
        word_embeddings = np.array([self.embeddings[word] for word in valid_words])

        distances_from_word = cdist(
            target_word_embedding,
            word_embeddings,
            metric=self.distance_metric,
        ).flatten()

        # Apply exponential mechanism for word selection
        cluster_sensitivity = self.intra_cluster_sensitivity.get(selected_cluster_label, 1.0)
        probabilities = self.exponential_mechanism(
            -distances_from_word,  # Negative because closer words should have higher probability
            cluster_sensitivity,
        )

        # Select replacement word
        selected_word = np.random.choice(valid_words, p=probabilities)
        
        # Additional filtering for clean suggestions
        if self.is_clean_suggestion(selected_word, target_word_lower):
            return selected_word, target_cluster_label, selected_cluster_label
        else:
            # If selected word is too similar, try another approach
            clean_words = [word for word in valid_words 
                          if self.is_clean_suggestion(word, target_word_lower)]
            if clean_words:
                # Re-calculate probabilities for clean words only
                clean_embeddings = np.array([self.embeddings[word] for word in clean_words])
                clean_distances = cdist(
                    target_word_embedding,
                    clean_embeddings,
                    metric=self.distance_metric,
                ).flatten()
                
                clean_probabilities = self.exponential_mechanism(
                    -clean_distances,
                    cluster_sensitivity,
                )
                final_word = np.random.choice(clean_words, p=clean_probabilities)
                return final_word, target_cluster_label, selected_cluster_label
            else:
                return selected_word, target_cluster_label, selected_cluster_label


# Example usage and testing
if __name__ == "__main__":
    import sys
    
    # Parse command line arguments
    epsilon = 1.0
    target_word = None
    
    if len(sys.argv) > 1:
        if len(sys.argv) == 2:
            target_word = sys.argv[1]
        elif len(sys.argv) == 3:
            target_word = sys.argv[1]
            try:
                epsilon = float(sys.argv[2])
            except ValueError:
                print("Invalid epsilon value. Using default epsilon=1.0")
                epsilon = 1.0
        else:
            print("Usage: python deprivacy_replacer.py <word> [epsilon]")
            sys.exit(1)
    
    # Initialize the replacer with specified epsilon
    replacer = DeprivacyReplacer(epsilon=epsilon)
    print(f"Using epsilon: {epsilon}")
    
    if target_word:
        print(f"Finding replacement for: {target_word}")
        
        # Generate multiple replacements to show variation
        print("\nReplacements:")
        for i in range(5):
            replacement, target_cluster, selected_cluster = replacer.replace_word(target_word)
            if replacement:
                cluster_info = "same cluster" if target_cluster == selected_cluster else "different cluster"
                print(f"{i+1}. {replacement} (from {cluster_info}: target={target_cluster}, selected={selected_cluster})")
            else:
                print(f"{i+1}. No replacement found")
    else:
        # Test with some example words
        test_words = ["john", "smith", "america", "christian", "paris", "london"]
        
        for word in test_words:
            print(f"\nTesting word: {word}")
            for i in range(3):
                replacement, target_cluster, selected_cluster = replacer.replace_word(word)
                if replacement:
                    cluster_info = "same cluster" if target_cluster == selected_cluster else "different cluster"
                    print(f"  Replacement {i+1}: {replacement} (from {cluster_info}: target={target_cluster}, selected={selected_cluster})")
                else:
                    print(f"  Replacement {i+1}: No replacement found")