/**
 * Urban Revolution — Main Application Controller
 * Orchestriert AI, 3D-Modul, Maße und Export.
 */

(function() {
    const state = {
        currentDesign: null,
        currentType: 'tshirt',
        currentColor: '#1a1a1a',
        currentMaterial: 'cotton',
        currentFit: 0.5,
        measurements: null
    };

    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => toast.classList.remove('show'), 3500);
    }

    function updateStep(stepNumber) {
        document.querySelectorAll('.step').forEach(s => {
            const num = parseInt(s.dataset.step, 10);
            s.classList.toggle('active', num <= stepNumber);
        });
    }

    function trackScrollSteps() {
        const sections = [
            { id: 'design', step: 1 },
            { id: 'measure', step: 2 },
            { id: 'preview', step: 3 },
            { id: 'production', step: 4 }
        ];

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const section = sections.find(s => s.id === entry.target.id);
                    if (section) updateStep(section.step);
                }
            });
        }, { rootMargin: '-30% 0px -50% 0px' });

        sections.forEach(s => {
            const el = document.getElementById(s.id);
            if (el) observer.observe(el);
        });
    }

    function initSuggestions() {
        document.querySelectorAll('.suggestion').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('ai-prompt').value = btn.dataset.prompt;
                document.getElementById('ai-prompt').focus();
            });
        });
    }

    function initTypeSelector() {
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.currentType = btn.dataset.type;
                if (window.garmentScene) {
                    window.garmentScene.setType(state.currentType);
                }
                updateProductionPreview();
            });
        });
    }

    function initColorPalette() {
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
                state.currentColor = swatch.dataset.color;
                if (window.garmentScene) {
                    window.garmentScene.setColor(state.currentColor);
                }
                if (state.currentDesign) {
                    state.currentDesign.color = state.currentColor;
                    updateProductionPreview();
                }
            });
        });
    }

    function initMaterialSelector() {
        const select = document.getElementById('material-select');
        if (select) {
            select.addEventListener('change', () => {
                state.currentMaterial = select.value;
                if (window.garmentScene) {
                    window.garmentScene.setMaterial(state.currentMaterial);
                }
                if (state.currentDesign) {
                    state.currentDesign.material = state.currentMaterial;
                    updateProductionPreview();
                }
            });
        }
    }

    function initFitSlider() {
        const slider = document.getElementById('fit-slider');
        if (slider) {
            slider.addEventListener('input', () => {
                state.currentFit = slider.value / 100;
                if (window.garmentScene) {
                    window.garmentScene.setFit(state.currentFit);
                }
                if (state.currentDesign) {
                    state.currentDesign.fit = state.currentFit;
                    updateProductionPreview();
                }
            });
        }
    }

    function initGenerateButton() {
        const btn = document.getElementById('generate-btn');
        btn.addEventListener('click', async () => {
            const prompt = document.getElementById('ai-prompt').value.trim();
            if (!prompt) {
                showToast('Bitte beschreibe dein gewünschtes Design', 'error');
                document.getElementById('ai-prompt').focus();
                return;
            }

            btn.classList.add('loading');
            btn.disabled = true;
            btn.querySelector('.btn-text').textContent = 'KI generiert...';

            try {
                const design = await AI.generateDesign(prompt, state.currentType);
                state.currentDesign = design;
                renderDesignResult(design);
                applyDesignToScene(design);
                updateProductionPreview();
                showToast(`Design "${design.name}" generiert!`, 'success');
            } catch (error) {
                console.error(error);
                showToast('Fehler bei der Generierung. Bitte erneut versuchen.', 'error');
            } finally {
                btn.classList.remove('loading');
                btn.disabled = false;
                btn.querySelector('.btn-text').textContent = 'Design generieren';
            }
        });
    }

    function renderDesignResult(design) {
        const output = document.getElementById('ai-output');
        const tags = design.tags && design.tags.length
            ? design.tags.map(t => `<span class="design-tag">${t}</span>`).join('')
            : '<span class="design-tag">custom</span>';

        output.innerHTML = `
            <div class="design-result">
                <h4>KI-DESIGN · ${design.designId}</h4>
                <h3>${design.name}</h3>
                <p>${design.description}</p>
                <div class="design-tags">${tags}</div>
            </div>
        `;

        document.getElementById('customize-controls').style.display = 'block';

        document.querySelectorAll('.color-swatch').forEach(s => {
            s.classList.toggle('active', s.dataset.color === design.color);
        });

        const matSelect = document.getElementById('material-select');
        if (matSelect && design.material) matSelect.value = design.material;

        const fitSlider = document.getElementById('fit-slider');
        if (fitSlider && design.fit !== undefined) fitSlider.value = Math.round(design.fit * 100);
    }

    function applyDesignToScene(design) {
        if (!window.garmentScene) return;
        state.currentColor = design.color;
        state.currentMaterial = design.material;
        state.currentFit = design.fit;
        if (design.type && design.type !== state.currentType) {
            state.currentType = design.type;
            document.querySelectorAll('.type-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.type === design.type);
            });
        }
        window.garmentScene.applyDesign(design);
    }

    function initMeasurements() {
        Measurements.FIELDS.forEach(field => {
            const input = document.getElementById(field);
            if (input) {
                input.addEventListener('input', updateMeasurements);
            }
        });

        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                Measurements.applyPreset(btn.dataset.preset);
                updateMeasurements();
                showToast(`Voreinstellung ${btn.dataset.preset} geladen`, 'success');
            });
        });

        updateMeasurements();
    }

    function updateMeasurements() {
        state.measurements = Measurements.read();
        if (window.garmentScene) {
            window.garmentScene.setMeasurements(state.measurements);
        }
        updateModelInfo();
        updateProductionPreview();
    }

    function updateModelInfo() {
        if (!state.measurements) return;
        const fabric = Measurements.estimateFabric(state.measurements, state.currentType);
        const seams = Measurements.estimateSeams(state.measurements, state.currentType);
        const size = Measurements.calculateSize(state.measurements);

        const fabricEl = document.getElementById('info-fabric');
        const seamsEl = document.getElementById('info-seams');
        const sizeEl = document.getElementById('info-size');

        if (fabricEl) fabricEl.textContent = `~ ${fabric} m²`;
        if (seamsEl) seamsEl.textContent = `${seams} cm`;
        if (sizeEl) sizeEl.textContent = size;
    }

    function initPreviewControls() {
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (window.garmentScene) {
                    window.garmentScene.setView(btn.dataset.view);
                }
            });
        });

        document.querySelectorAll('.avatar-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const avatarKey = btn.dataset.avatar;
                if (window.garmentScene) {
                    window.garmentScene.setAvatar(avatarKey);
                }
                // Maße aus dem Preset übernehmen (wenn Toggle aktiv)
                const loadDefaults = document.getElementById('toggle-load-defaults');
                if (loadDefaults?.checked && window.AVATAR_PRESETS) {
                    const preset = window.AVATAR_PRESETS[avatarKey];
                    if (preset?.defaults) {
                        Measurements.write({ ...preset.defaults, weight: state.measurements?.weight || 70 });
                        updateMeasurements();
                        showToast(`Maße für ${preset.label} geladen`, 'success');
                    }
                }
            });
        });

        const toggleAvatar = document.getElementById('toggle-avatar');
        toggleAvatar?.addEventListener('change', () => {
            if (window.garmentScene) {
                window.garmentScene.setShowAvatar(toggleAvatar.checked);
            }
        });

        const toggleMeasurements = document.getElementById('toggle-measurements');
        toggleMeasurements?.addEventListener('change', () => {
            if (window.garmentScene) {
                window.garmentScene.setShowMeasurements(toggleMeasurements.checked);
            }
        });

        const toggleWireframe = document.getElementById('toggle-wireframe');
        toggleWireframe?.addEventListener('change', () => {
            if (window.garmentScene) {
                window.garmentScene.setWireframe(toggleWireframe.checked);
            }
        });
    }

    function updateProductionPreview() {
        if (!state.measurements) return;

        const design = state.currentDesign || {
            name: 'Untitled Design',
            description: 'Noch kein Design generiert. Beschreibe oben dein Wunsch-Outfit.',
            designId: 'UR-XXXXXX',
            originalPrompt: '–',
            color: state.currentColor,
            material: state.currentMaterial,
            fit: state.currentFit,
            tags: [],
            constructionNotes: ['Generiere zuerst ein Design, um Schneider-Notizen zu erhalten.'],
            generatedAt: new Date().toISOString()
        };

        const specData = Export.buildSpecData(design, state.measurements, state.currentType);

        document.getElementById('spec-title').textContent = design.name.toUpperCase();
        document.getElementById('spec-id').textContent = `Design ID: ${design.designId}`;
        document.getElementById('spec-date').textContent = new Date().toLocaleDateString('de-DE');
        document.getElementById('spec-brief').textContent = `"${design.originalPrompt}" — ${design.description}`;
        document.getElementById('spec-type').textContent = state.currentType;
        document.getElementById('spec-material').textContent = state.currentMaterial;

        const colorCell = document.getElementById('spec-color');
        colorCell.innerHTML = `<span style="display:inline-block;width:14px;height:14px;background:${state.currentColor};border:1px solid #ccc;border-radius:3px;vertical-align:middle;margin-right:6px"></span>${state.currentColor}`;

        document.getElementById('spec-fit').textContent = specData.specifications.fit;
        document.getElementById('spec-size').textContent = specData.specifications.size;

        const measuresTable = document.getElementById('spec-measures');
        measuresTable.innerHTML = Object.entries(state.measurements)
            .map(([k, v]) => `<tr><td>${Measurements.LABELS[k] || k}</td><td>${v} cm</td></tr>`)
            .join('');

        const notesList = document.getElementById('spec-notes');
        notesList.innerHTML = (design.constructionNotes || []).map(n => `<li>${n}</li>`).join('');

        document.getElementById('est-time').textContent = `${specData.production.estimatedProductionDays} Tage`;
        document.getElementById('est-price').textContent = `${specData.production.estimatedPriceRange.currency} ${specData.production.estimatedPriceRange.min} – ${specData.production.estimatedPriceRange.max}`;
    }

    function getCurrentSpecData() {
        if (!state.currentDesign) {
            showToast('Bitte zuerst ein Design generieren', 'error');
            return null;
        }
        return Export.buildSpecData(state.currentDesign, state.measurements, state.currentType);
    }

    function initExportButtons() {
        document.getElementById('download-json').addEventListener('click', () => {
            const spec = getCurrentSpecData();
            if (!spec) return;
            Export.downloadJSON(spec);
            showToast('JSON-Datei heruntergeladen', 'success');
        });

        document.getElementById('download-html').addEventListener('click', () => {
            const spec = getCurrentSpecData();
            if (!spec) return;
            Export.downloadHTML(spec);
            showToast('Druckbare Vorlage heruntergeladen', 'success');
        });

        document.getElementById('print-spec').addEventListener('click', () => {
            const spec = getCurrentSpecData();
            if (!spec) return;
            Export.print();
        });

        document.getElementById('send-order').addEventListener('click', async () => {
            const spec = getCurrentSpecData();
            if (!spec) return;
            showToast('Auftrag wird übermittelt...', 'info');
            const result = await Export.simulateOrderSubmission(spec);
            if (result.success) {
                showToast(`✓ ${result.confirmation}. Lieferung ca. ${result.estimatedDelivery}`, 'success');
            }
        });
    }

    function init() {
        initSuggestions();
        initTypeSelector();
        initColorPalette();
        initMaterialSelector();
        initFitSlider();
        initGenerateButton();
        initMeasurements();
        initPreviewControls();
        initExportButtons();
        trackScrollSteps();

        const defaultViewBtn = document.querySelector('.view-btn[data-view="front"]');
        if (defaultViewBtn) defaultViewBtn.classList.add('active');

        window.addEventListener('garment-scene-ready', () => {
            if (state.measurements && window.garmentScene) {
                window.garmentScene.setMeasurements(state.measurements);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
