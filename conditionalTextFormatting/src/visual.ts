/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
    "use strict";

    import pixelConverterFromPoint = powerbi.extensibility.utils.type.PixelConverter.fromPoint;

    interface ViewModel {
        color: string;
        measure: number;
    }

    function parseSettings(dataView: DataView): VisualSettings {
        return VisualSettings.parse(dataView) as VisualSettings;
    }

    function isActive(state, stateValue) {
        if (state.enabled && state.condition && state.value && state.color) {
            switch (state.condition) {
                case 'gt':
                    return stateValue > state.value;
                case 'lt':
                    return stateValue < state.value;
                case 'eq':
                    return stateValue === state.value;

            }
        }
        return false;
    }

    function visualTransform(options: VisualUpdateOptions, host: IVisualHost): ViewModel {
        try {
            let dataView = options && options.dataViews && options.dataViews[0];
            let settings = parseSettings(dataView);
            let values = dataView.categorical.values;
            let measure, stateValue, state;
            if (values.length > 1) {
                measure = values[0].values[0];
                stateValue = values[0].values[0];
            } else {
                throw new Error("Invalid values");
            }
            for (let key in settings) {
                if (isActive(settings[key], stateValue)) {
                    state = settings[key];
                }
            }
            if (!state) {
                return {
                    color: 'inherit',
                    measure: stateValue
                };
            }
            return {
                color: state.color,
                measure: stateValue
            };
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    export class Visual implements IVisual {
        private target: HTMLElement;
        private host: IVisualHost;
        private settings: VisualSettings;

        constructor(options: VisualConstructorOptions) {
            this.target = options.element;
        }

        public update(options: VisualUpdateOptions) {
            this.settings = parseSettings(options && options.dataViews && options.dataViews[0]);
            let viewModel: ViewModel = visualTransform(options, this.host);
            this.target.style.color = viewModel.color;
            this.target.textContent = String(viewModel.measure);
            let textSettings = this.settings.text;
            this.target.style.fontSize = pixelConverterFromPoint(textSettings.fontSize);
            this.target.style.fontFamily = textSettings.fontFamily;
            this.target.style.textAlign = textSettings.textAlign;
        }

        /**
         * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
         * objects and properties you want to expose to the users in the property pane.
         *
         */
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
            return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
        }
    }
}
