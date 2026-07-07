/**
 * Urban Revolution — State Manager
 * Event-driven state management with validation and change tracking
 */

const StateManager = (() => {
    const DEFAULT_STATE = {
        currentDesign: null,
        currentType: 'tshirt',
        currentColor: '#1a1a1a',
        currentMaterial: 'cotton',
        currentFit: 0.5,
        currentLength: 'regular',
        currentPrint: '',
        measurements: null,
        avatar: 'male_regular',
        skinTone: '#d8d4cf',
        hairColor: '#3a2010',
        userPhoto: null
    };
    const state = { ...DEFAULT_STATE };

    const listeners = new Map(); // eventType -> Set of callbacks
    const history = [];
    const MAX_HISTORY = 50;

    function subscribe(eventType, callback) {
        if (!listeners.has(eventType)) {
            listeners.set(eventType, new Set());
        }
        listeners.get(eventType).add(callback);
        
        // Return unsubscribe function
        return () => {
            listeners.get(eventType).delete(callback);
        };
    }

    function emit(eventType, detail) {
        if (listeners.has(eventType)) {
            listeners.get(eventType).forEach(cb => {
                try {
                    cb(detail);
                } catch (err) {
                    console.error(`[StateManager] Listener error for ${eventType}:`, err);
                }
            });
        }
    }

    function set(key, value) {
        if (!(key in state)) {
            throw new Error(`Unknown state key: ${key}`);
        }

        const oldValue = state[key];
        if (oldValue === value) return; // No-op if unchanged

        try {
            // Validate based on key
            let validatedValue = value;
            if (key === 'currentType') {
                validatedValue = CONFIG.validateGarmentType(value);
            } else if (key === 'currentMaterial') {
                validatedValue = CONFIG.validateMaterial(value);
            } else if (key === 'currentColor' || key === 'skinTone' || key === 'hairColor') {
                validatedValue = CONFIG.validateColor(value);
            } else if (key === 'currentFit') {
                const fit = parseFloat(value);
                if (isNaN(fit) || fit < 0 || fit > 1) {
                    throw new Error('currentFit must be between 0 and 1');
                }
                validatedValue = fit;
            } else if (key === 'currentLength') {
                validatedValue = CONFIG.validateLength(value);
            } else if (key === 'currentPrint') {
                validatedValue = CONFIG.validatePrint(value);
            }

            state[key] = validatedValue;

            // Track history
            history.push({
                timestamp: Date.now(),
                key,
                oldValue,
                newValue: validatedValue
            });
            if (history.length > MAX_HISTORY) {
                history.shift();
            }

            // Emit events
            emit(`${key}:change`, { oldValue, newValue: validatedValue });
            emit('state:change', { key, oldValue, newValue: validatedValue });

        } catch (err) {
            console.error(`[StateManager] Validation error for ${key}:`, err);
            emit('error', { key, error: err.message });
            throw err;
        }
    }

    function get(key) {
        if (!(key in state)) {
            throw new Error(`Unknown state key: ${key}`);
        }
        return state[key];
    }

    function getAll() {
        return { ...state };
    }

    function reset() {
        // Mirror set()'s event contract per key (not just the blanket
        // state:reset) so subscribers like app.js's updateOwnInfo/
        // syncOwnEditor/updateVtoButtonState — wired only to `${key}:change`
        // — actually pick up the reverted values instead of showing stale DOM.
        Object.keys(DEFAULT_STATE).forEach((key) => {
            const oldValue = state[key];
            const newValue = DEFAULT_STATE[key];
            if (oldValue === newValue) return;
            state[key] = newValue;
            emit(`${key}:change`, { oldValue, newValue });
            emit('state:change', { key, oldValue, newValue });
        });

        emit('state:reset', {});
    }

    function getHistory() {
        return [...history];
    }

    // Cleanup
    function destroy() {
        listeners.clear();
        history.length = 0;
    }

    return {
        get,
        set,
        getAll,
        subscribe,
        emit,
        reset,
        getHistory,
        destroy
    };
})();

if (typeof window !== "undefined") window.StateManager = StateManager;
if (typeof module !== "undefined" && module.exports) module.exports = StateManager;
