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
        private cardTitle: Selection<HTMLElement>;
        private cardNumber: Selection<HTMLElement>;
        private svg: Selection<HTMLElement>;
        private chart: Selection<HTMLElement>;
        private xAxis: Selection<HTMLElement>;
        private yAxis: Selection<HTMLElement>;
        private line: Selection<HTMLElement>;

        constructor(options: VisualConstructorOptions) {
            this.target = d3.select(options.element).append('div');
            this.cardTitle = this.target.append('div').attr('class', 'card-title');
            this.cardNumber = this.cardTitle.append('div').attr('class', 'card-number');
            this.svg = this.target.append('svg');
            this.chart = this.svg.append('g').attr('class', 'chart');
            this.xAxis = this.chart.append('g')
                .attr('class', 'x axis');
            this.yAxis = this.chart.append('g')
                .attr('class', 'y axis')
                .attr('transform', 'translate(60, 30)');
            this.line = this.chart.append('path')
                .attr('transform', 'translate(60, 30)');
            this.host = options.host;
        }

        public update(options: VisualUpdateOptions) {
            try {
                let dataView = options && options.dataViews && options.dataViews[0];
                let settings = Visual.parseSettings(dataView);
                let viewModel: ViewModel = visualTransform(options, this.host);

                this.cardTitle.style('height', (options.viewport.height / 4) + 'px');

                let cardNumber = this.cardNumber
                    .style('font-size', pixelConverterFromPoint(settings.cardNumber.fontSize))
                    .datum(viewModel.cardNumber);
                cardNumber.text(function (d) {
                    return compactInteger(d.value);
                });

                let width = options.viewport.width - 60;
                let height = options.viewport.height * 3 / 4 - 30 - 30;
                this.svg.attr('width', width + 60);
                this.svg.attr('height', height + 30 + 30);

                let x = d3.time.scale().range([0, width]);
                let y = d3.scale.linear().range([height, 0]);
                let xAxis = d3.svg.axis().scale(x).orient('bottom').ticks(5);
                let yAxis = d3.svg.axis().scale(y).orient('left').ticks(5)
                    .tickSize(-width)
                    .tickFormat(function (d) { return compactInteger(d); });
                var line = d3.svg.line()
                    .x(function (d: any) { return x(d.date); })
                    .y(function (d: any) { return y(d.value); });

                let dates = dataView.categorical.categories[0].values;
                let values = dataView.categorical.values[0].values;
                let data = dates.map(function (d, i) {
                    return {
                        date: d,
                        value: values[i]
                    };
                });
                x.domain(d3.extent(data, function (d: any) { return d.date; }));
                y.domain(d3.extent(data, function (d: any) { return d.value; }));

                this.xAxis.attr('transform', 'translate(60, ' + (height + 30) + ')')
                    .call(xAxis);
                this.yAxis.call(yAxis);
                this.line.datum(data).attr('d', <any>line);

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
