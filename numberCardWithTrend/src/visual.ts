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

    import Selection = d3.Selection;

    import pixelConverterFromPoint = powerbi.extensibility.utils.type.PixelConverter.fromPoint;

    interface ViewModel {
        cardNumber: CardNumber;
    };

    interface CardNumber {
        value: any;
    };

    function visualTransform(options: VisualUpdateOptions, host: IVisualHost): ViewModel {
        let dataView = options && options.dataViews && options.dataViews[0];
        let values = dataView.categorical.values[0].values;
        let cardNumber = values[values.length - 1];
        return {
            cardNumber: {
                value: cardNumber
            }
        };
    }

    export class Visual implements IVisual {
        private target: Selection<HTMLElement>;
        private host: IVisualHost;
        private settings: VisualSettings;
        private cardNumber: Selection<HTMLElement>;

        constructor(options: VisualConstructorOptions) {
            this.target = d3.select(options.element).append('div');
            this.host = options.host;
        }

        public update(options: VisualUpdateOptions) {
            try {
                this.target.html(null);
                let settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);
                let viewModel: ViewModel = visualTransform(options, this.host);
                let cardNumber = this.target.append('div')
                    .classed('card-number', true)
                    .style('font-size', pixelConverterFromPoint(settings.cardNumber.fontSize))
                    .datum(viewModel.cardNumber);
                cardNumber.text(function (d) {
                    return compactInteger(d.value);
                });
            } catch (e) {
                console.error(e);
                throw e;
            }
        }

        private static parseSettings(dataView: DataView): VisualSettings {
            return VisualSettings.parse(dataView) as VisualSettings;
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
