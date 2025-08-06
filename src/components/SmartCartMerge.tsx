// Smart Auto-Merge System
import React from 'react';
import { Cart, CartItem } from '../types';

interface SmartMergeConfig {
  autoMergeThreshold: number; // Number of similar items to trigger auto-merge
  enableAutoMerge: boolean;
  mergeStrategy: 'byProduct' | 'byTime' | 'manual';
}

export const useSmartCartMerge = (
  carts: Cart[],
  config: SmartMergeConfig = {
    autoMergeThreshold: 3,
    enableAutoMerge: true,
    mergeStrategy: 'byProduct'
  }
) => {
  
  // Analyze cart similarity
  const analyzeCartSimilarity = (cart1: Cart, cart2: Cart): number => {
    const cart1Products = new Set(cart1.items.map(item => item.productId));
    const cart2Products = new Set(cart2.items.map(item => item.productId));
    
    const intersection = new Set([...cart1Products].filter(x => cart2Products.has(x)));
    const union = new Set([...cart1Products, ...cart2Products]);
    
    return intersection.size / union.size; // Jaccard similarity
  };

  // Find mergeable cart pairs
  const findMergeablePairs = (): Array<{
    cart1: Cart;
    cart2: Cart;
    similarity: number;
    reason: string;
  }> => {
    const pairs: Array<{
      cart1: Cart;
      cart2: Cart;
      similarity: number;
      reason: string;
    }> = [];

    for (let i = 0; i < carts.length; i++) {
      for (let j = i + 1; j < carts.length; j++) {
        const cart1 = carts[i];
        const cart2 = carts[j];
        
        const similarity = analyzeCartSimilarity(cart1, cart2);
        
        let reason = '';
        if (similarity > 0.7) {
          reason = 'High product overlap';
        } else if (cart1.name.toLowerCase().includes(cart2.name.toLowerCase()) || 
                   cart2.name.toLowerCase().includes(cart1.name.toLowerCase())) {
          reason = 'Similar names';
        } else if (cart1.items.length < 3 && cart2.items.length < 3) {
          reason = 'Both carts have few items';
        }

        if (reason) {
          pairs.push({ cart1, cart2, similarity, reason });
        }
      }
    }

    return pairs.sort((a, b) => b.similarity - a.similarity);
  };

  // Smart merge suggestions
  const getMergeSuggestions = () => {
    const pairs = findMergeablePairs();
    
    return pairs.map(pair => ({
      ...pair,
      confidence: Math.round(pair.similarity * 100),
      estimatedBenefit: calculateMergeBenefit(pair.cart1, pair.cart2)
    }));
  };

  // Calculate merge benefit
  const calculateMergeBenefit = (cart1: Cart, cart2: Cart): string => {
    const totalItems = cart1.items.length + cart2.items.length;
    
    if (totalItems < 5) return 'Low impact';
    if (totalItems < 10) return 'Medium impact';
    return 'High impact - significant consolidation';
  };

  // Auto-merge based on rules
  const autoMergeByRules = (): Cart[] => {
    if (!config.enableAutoMerge) return carts;

    let workingCarts = [...carts];
    const suggestions = getMergeSuggestions();
    
    // Auto-merge high confidence pairs
    const autoMergePairs = suggestions.filter(s => s.confidence > 85);
    
    autoMergePairs.forEach(pair => {
      const sourceIndex = workingCarts.findIndex(c => c.id === pair.cart1.id);
      const targetIndex = workingCarts.findIndex(c => c.id === pair.cart2.id);
      
      if (sourceIndex === -1 || targetIndex === -1) return;

      // Merge cart1 into cart2
      const mergedItems = [
        ...workingCarts[targetIndex].items,
        ...workingCarts[sourceIndex].items.map(item => ({
          ...item,
          addedAt: new Date().toISOString(),
          editedBy: 'Auto-merge',
          editedAt: new Date().toISOString()
        }))
      ];

      workingCarts[targetIndex] = {
        ...workingCarts[targetIndex],
        items: mergedItems,
        total: mergedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        needsReprint: true,
        lastModifiedAt: new Date().toISOString(),
        lastModifiedBy: 'Smart Auto-merge'
      };

      // Remove source cart
      workingCarts.splice(sourceIndex, 1);
    });

    return workingCarts;
  };

  return {
    getMergeSuggestions,
    autoMergeByRules,
    analyzeCartSimilarity,
    findMergeablePairs
  };
};

// Smart merge suggestions component
interface SmartMergeSuggestionsProps {
  carts: Cart[];
  onMerge: (sourceCartId: string, targetCartId: string) => void;
  onDismiss: (suggestionId: string) => void;
}

export const SmartMergeSuggestions: React.FC<SmartMergeSuggestionsProps> = ({
  carts,
  onMerge,
  onDismiss
}) => {
  const { getMergeSuggestions } = useSmartCartMerge(carts);
  const [suggestions] = React.useState(getMergeSuggestions());
  const [dismissedSuggestions, setDismissedSuggestions] = React.useState<Set<string>>(new Set());

  const activeSuggestions = suggestions.filter(s => 
    !dismissedSuggestions.has(`${s.cart1.id}-${s.cart2.id}`)
  );

  if (activeSuggestions.length === 0) return null;

  return (
    <div className="alert alert-info">
      <h6 className="alert-heading">
        <i className="bi bi-lightbulb me-2"></i>
        Smart Merge Suggestions
      </h6>
      
      {activeSuggestions.slice(0, 3).map(suggestion => (
        <div 
          key={`${suggestion.cart1.id}-${suggestion.cart2.id}`}
          className="d-flex align-items-center justify-content-between mb-2 p-2 bg-white rounded"
        >
          <div className="flex-grow-1">
            <div className="fw-bold">
              Merge "{suggestion.cart1.name}" → "{suggestion.cart2.name}"
            </div>
            <small className="text-muted">
              {suggestion.reason} • {suggestion.confidence}% confidence • {suggestion.estimatedBenefit}
            </small>
          </div>
          
          <div className="btn-group btn-group-sm">
            <button
              className="btn btn-success"
              onClick={() => onMerge(suggestion.cart1.id, suggestion.cart2.id)}
            >
              Merge
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={() => {
                const id = `${suggestion.cart1.id}-${suggestion.cart2.id}`;
                setDismissedSuggestions(prev => new Set([...prev, id]));
                onDismiss(id);
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
