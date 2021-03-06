/*
 *  Power BI Visualizations
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
    import DataViewObjectsParser = powerbi.extensibility.utils.dataview.DataViewObjectsParser;

    export class VisualSettings extends DataViewObjectsParser {
        public card: CardSettings = new CardSettings();
        public image: ImageSettings = new ImageSettings();
        public date: DateSettings = new DateSettings();
        public metric: MetricSettings = new MetricSettings();
        public measure: MeasureSettings = new MeasureSettings();
        public chart: ChartSettings = new ChartSettings();
        public change: ChangeSettings = new ChangeSettings();
    }

    export class CardSettings {
        public padding: number = 5;
    }

    export class ImageSettings {
        public url: string = null;
        public scale: number = 100;
    }

    export class DateSettings {
        public show: boolean = true;
    }

    export class MetricSettings {
        public fontSize: number = 10;
        public fontColor: string = 'black';
    }

    export class MeasureSettings {
        public fontSize: number = 24;
    }

    export class ChartSettings {
        public type: string = 'bar';
        public color: string = 'black';
        public showTrend: boolean = true;
        public trendColor: string = 'black';
    }

    export class ChangeSettings {
        public fontSize: number = 18;
        public text: string = '';
        public color1: string = '#f02708';
        public limit1: number = 0.33;
        public color2: string = '#f3a30c';
        public limit2: number = 0.67;
        public color3: string = '#37b012';
    }

}
