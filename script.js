class Vec2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    length() {
        return Math.hypot(this.x, this.y);
    }

    angle() {
        return Math.atan2(this.y, this.x);
    }

    static sub(a = new Vec2(), b = new Vec2()) {
        return new Vec2(a.x - b.x, a.y - b.y);
    }

    static add(a = new Vec2, b = new Vec2) {
        return new Vec2(a.x + b.x, a.y + b.y);
    }

    static from_polar(angle, len) {
        return new Vec2(Math.cos(angle) * len, Math.sin(angle) * len);
    }
}

class Line {
    constructor(start = new Vec2, end = new Vec2) {
        this.start = start;
        this.end = end;
    }

    length() {
        return Vec2.sub(this.end, this.start).length();
    }

    angle() {
        return Vec2.sub(this.end, this.start).angle();
    }

    draw(ctx) {
        ctx.beginPath();

        ctx.moveTo(this.start.x, this.start.y);
        ctx.lineTo(this.end.x, this.end.y);

        ctx.stroke();
        ctx.closePath();
    }
}

class Position {
    constructor(value) {
        this.value = value
    }

    convert(lines = [new Line()]) {
        let value = this.value;

        for (let line of lines) {
            if (line.length() >= value) {
                let angle = line.angle();

                return Vec2.add(line.start, Vec2.from_polar(angle, value))
            } else {
                value -= line.length()
            }
        }
    }
}

class Conductor {
    constructor(charges_count, charges_value, length) {
        this.charges_count = charges_count
        this.charges_value = charges_value
        this.length = length

        this.shift = 0;
    }

    charges_distance() {
        return this.length / this.charges_count;
    }

    update(amperage, delta_time) {
        let charges_speed = amperage * this.charges_distance() / this.charges_value;
        let delta_shift = charges_speed * delta_time;

        this.shift += delta_shift;
        this.shift %= this.length;
    }

    charges() {
        function mod(a, b) {
            if (a >= 0) {
                return a % b;
            } else {
                return b - (-a) % b;
            }
        }

        let charges = Array.from(
            new Array(this.charges_count),
            (_, n) => new Position(mod((n * this.charges_distance() + this.shift), this.length))
        );

        return charges;
    }
}

class OscillatoryCircuit {
    #max_voltage;

    constructor({ capacitance, inductance, max_voltage, charges_count, charges_value, size = new Vec2, pos = new Vec2 }) {
        this.conductor = new Conductor(charges_count, charges_value, 2 * (size.x + size.y));

        let points = [
            new Vec2(0, 0), new Vec2(size.x, 0), size, new Vec2(0, size.y)
        ].map(point => Vec2.add(pos, point))

        this.lines = [
            new Line(points[0], points[1]),
            new Line(points[1], points[2]),
            new Line(points[2], points[3]),
            new Line(points[3], points[0]),
        ];

        this.size = size;

        this.capacitance = capacitance;
        this.inductance = inductance;
        this.#max_voltage = max_voltage;
    }

    max_voltage() {
        return this.#max_voltage;
    }

    max_amperage() {
        return this.max_voltage() * Math.sqrt(this.capacitance / this.inductance);
    }

    max_charge() {
        return this.max_amperage() / this.frequency();
    }

    energy() {
        return this.max_voltage() ** 2 * this.capacitance / 2;
    }

    frequency() {
        return (this.inductance * this.capacitance) ** (-1 / 2);
    }

    amperage(time) {
        return this.max_amperage() * Math.sin(this.frequency() * time);
    }

    voltage(time) {
        return this.max_voltage() * Math.cos(this.frequency() * time);
    }

    charge(time) {
        return this.max_charge() * -Math.cos(this.frequency() * time);
    }

    capacitor_energy(time) {
        return this.energy() * Math.cos(this.frequency() * time) ** 2;
    }

    inductor_energy(time) {
        return this.energy() * Math.sin(this.frequency() * time) ** 2;
    }

    update(time, delta_time) {
        this.conductor.update(this.amperage(time), delta_time);
    }

    /// drawing
    draw(ctx) {
        let [left_up, right_up] = [this.lines[0].start, this.lines[0].end];

        OscillatoryCircuit.draw_capacitor(ctx, this.size.y, right_up);
        OscillatoryCircuit.draw_inductor(ctx, this.size.y, left_up);

        this.lines[0].draw(ctx);
        this.lines[2].draw(ctx);

        ctx.fillStyle = 'yellow'

        this.conductor.charges().map(a => a.convert(this.lines)).forEach(charge => {
            ctx.fillRect(charge.x - 2, charge.y - 2, 4, 4);
        })
    }

    static draw_inductor(ctx, length = 0, pos = new Vec2) {
        const HUMP_RADIUS = 10;

        let centers = [
            new Vec2(pos.x, pos.y + length / 2 + HUMP_RADIUS * 2),
            new Vec2(pos.x, pos.y + length / 2),
            new Vec2(pos.x, pos.y + length / 2 - HUMP_RADIUS * 2)
        ];

        ctx.beginPath()

        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x, pos.y + (length - HUMP_RADIUS * 2 * 3) / 2);

        for (let center of centers) {
            ctx.arc(center.x, center.y, HUMP_RADIUS, Math.PI / 2, 3 * Math.PI / 2);
        }

        ctx.moveTo(pos.x, pos.y + length - (length - HUMP_RADIUS * 2 * 3) / 2);
        ctx.lineTo(pos.x, pos.y + length);

        ctx.stroke()
        ctx.closePath()

        for (let center of centers) {
            ctx.arc(center.x, center.y, HUMP_RADIUS, Math.PI / 2, 3 * Math.PI / 2);
        }
    }

    static draw_capacitor(ctx, length = 0, pos = new Vec2) {
        const CAPACITOR_PLATES_DISTANCE = 10;
        const CAPACITOR_PLATES_SIZE = 20;

        let line_length = (length - CAPACITOR_PLATES_DISTANCE) / 2;

        ctx.beginPath();

        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x, pos.y + line_length);

        ctx.moveTo(pos.x - CAPACITOR_PLATES_SIZE / 2, pos.y + line_length);
        ctx.lineTo(pos.x + CAPACITOR_PLATES_SIZE / 2, pos.y + line_length);

        ctx.moveTo(pos.x - CAPACITOR_PLATES_SIZE / 2, pos.y + length - line_length);
        ctx.lineTo(pos.x + CAPACITOR_PLATES_SIZE / 2, pos.y + length - line_length);

        ctx.moveTo(pos.x, pos.y + length - line_length);
        ctx.lineTo(pos.x, pos.y + length);

        ctx.stroke();
        ctx.closePath();
    }
}

class FunctionGraph {
    constructor({ label = "", f = () => { }, color }) {
        this.label = label;
        this.f = f;
        this.color = color;
    }

    draw(ctx, pos = new Vec2, length, t_end, scale = new Vec2) {
        const N = 20;

        ctx.moveTo(pos.x, pos.y);

        ctx.beginPath();

        ctx.strokeStyle = this.color;

        for (let t = Math.max(0, length / scale.x - t_end / 1000) * N; t * scale.x < length * N; t++) {
            let value = this.f(t_end / 1000 - length / scale.x + t / N);

            let point = new Vec2(t / N * scale.x, -value * scale.y);

            point = Vec2.add(pos, point);

            ctx.lineTo(point.x, point.y);
        }

        ctx.stroke();
        ctx.closePath();
    }
}

const AXIS_MARK_HEIGHT = 0.7;
const MARK_WIDTH = 6;

class FunctionGraphs {
    constructor({
        ctx,
        pos = new Vec2, size = new Vec2,
        functions = [new FunctionGraph],
        max_value, min_value,
        time_interval, period
    }) {
        ctx.font = "18px Source code pro"
        ctx.lineWidth = 2;

        this.pos = pos;
        this.size = size;

        min_value ??= -max_value;

        this.scale = new Vec2(
            size.x / time_interval,
            AXIS_MARK_HEIGHT * size.y / (max_value - min_value)
        );

        this.x_axis_start = new Vec2(
            this.pos.x,
            this.pos.y + 0.5 * this.size.y
            + this.scale.y * 0.5 * (max_value + min_value) / AXIS_MARK_HEIGHT
        );

        this.functions = functions;
        this.ctx = ctx;

        this.max_value = max_value;
        this.min_value = min_value;

        this.time_interval = time_interval;
        this.period = period;
    }

    draw(t_end) {
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

        this.draw_graphs(t_end);

        this.ctx.strokeStyle = 'black'

        this.draw_y_axis();
        this.draw_x_axis(t_end);
    }

    draw_graphs(t_end) {
        for (let graph of this.functions) {
            graph.draw(this.ctx, this.x_axis_start, this.size.x, t_end, this.scale);
        }
    }

    draw_y_axis() {
        // draw stick
        let start = new Vec2(this.pos.x, this.pos.y + this.size.y);
        let end = this.pos;

        let line = new Line(start, end);

        line.draw(this.ctx);

        // draw mark
        let mark_center = Vec2.add(
            new Vec2(0, (this.x_axis_start.y - this.pos.y) * (1 - AXIS_MARK_HEIGHT)),
            this.pos
        );

        this.ctx.beginPath();

        this.ctx.moveTo(mark_center.x - MARK_WIDTH / 2, mark_center.y);
        this.ctx.lineTo(mark_center.x + MARK_WIDTH / 2, mark_center.y);

        this.ctx.stroke();
        this.ctx.closePath();

        // draw mark label
        this.ctx.fillText((Math.round(this.max_value * 100) / 100).toString(), mark_center.x + MARK_WIDTH / 2, mark_center.y);

        // draw arrow
        this.ctx.beginPath();

        this.ctx.moveTo(end.x, end.y);
        this.ctx.lineTo(end.x - 5, end.y + 5);
        this.ctx.lineTo(end.x + 5, end.y + 5);
        this.ctx.lineTo(end.x, end.y);

        this.ctx.fill();
        this.ctx.closePath();

        // draw labels
        this.functions.reduce((shift, f) => {
            this.ctx.fillStyle = f.color;

            this.ctx.fillText(f.label, end.x + shift, end.y);

            return shift + this.ctx.measureText(f.label).width + 10;
        }, 0);

        this.ctx.fillStyle = 'black';
    }

    draw_x_axis(t_end) {
        // draw stick
        let end = Vec2.add(this.x_axis_start, new Vec2(this.size.x, 0));

        let line = new Line(this.x_axis_start, end);

        line.draw(this.ctx);

        // draw arrow
        this.ctx.moveTo(end.x, end.y);
        this.ctx.lineTo(end.x - 5, end.y + 5);
        this.ctx.lineTo(end.x - 5, end.y - 5);
        this.ctx.lineTo(end.x, end.y);

        this.ctx.fill();
        this.ctx.closePath();

        // draw marks

        // seconds
        t_end /= 1000;
        let t_start = t_end - this.time_interval;
        let quarter_period = this.period / 4;

        for (
            let n = Math.ceil(t_start / quarter_period);
            n <= Math.floor(t_end / quarter_period);
            n++
        ) {
            let mark_t = quarter_period * n;
            let mark_pos = Vec2.add(this.x_axis_start, new Vec2((mark_t - t_start) * this.scale.x, 0))

            // draw mark
            this.ctx.beginPath();
            this.ctx.moveTo(mark_pos.x, mark_pos.y - MARK_WIDTH / 2);
            this.ctx.lineTo(mark_pos.x, mark_pos.y + MARK_WIDTH / 2);
            this.ctx.closePath();
            this.ctx.stroke();

            // draw label
            this.ctx.fillText((Math.round(mark_t * 10) / 10).toString(), mark_pos.x, mark_pos.y - MARK_WIDTH / 2)
        }

        // draw label
        this.ctx.fillText("t, c", end.x, end.y);
    }
}

const PERIODS = 1;
const DELTA_TIME = 20;

const control_button = document.getElementById("control");

let interval_id;
let ongoing = false;

function start() {
    const osc_ctx = document.getElementById("main").getContext('2d');

    const osc = new OscillatoryCircuit({
        capacitance: parseFloat(document.getElementById("capacitance").value),
        inductance: parseFloat(document.getElementById("inductance").value),
        max_voltage: parseFloat(document.getElementById("max_voltage").value),

        charges_count: 20,
        charges_value: 50,

        size: new Vec2(300, 300),
        pos: new Vec2(100, 100)
    });

    document.getElementById("max_charge").textContent = osc.max_charge() + "Кл";
    document.getElementById("max_energy").textContent = osc.energy() + "Дж";
    document.getElementById("frequency").textContent = osc.frequency() + "Гц";

    let time = 0;

    const period = 2 * Math.PI / osc.frequency();

    const pos = new Vec2(18, 18);
    const size = new Vec2(352 - 18, 212);

    const graphs = [
        new FunctionGraphs({
            ctx: document.getElementById("voltage").getContext('2d'),

            pos, size,

            max_value: osc.max_voltage(),
            time_interval: PERIODS * period,
            period,

            functions: [
                new FunctionGraph({
                    label: "U, В",
                    f: osc.voltage.bind(osc),
                    color: "aqua" //"rgb(255, 128, 0)"
                })
            ]
        }),

        new FunctionGraphs({
            ctx: document.getElementById("amperage").getContext("2d"),

            pos, size,

            max_value: osc.max_amperage(),
            time_interval: PERIODS * period,
            period,

            functions: [
                new FunctionGraph({
                    label: "I, A",
                    f: osc.amperage.bind(osc),
                    color: "magenta",
                })
            ]
        }),

        new FunctionGraphs({
            ctx: document.getElementById("energies").getContext("2d"),

            pos, size,

            max_value: osc.energy(),
            min_value: 0,
            time_interval: PERIODS * period * 0.5,
            period: period * 0.5,

            functions: [
                new FunctionGraph({
                    label: "Wl, Дж",
                    f: osc.inductor_energy.bind(osc),
                    color: "red",
                }),
                new FunctionGraph({
                    label: "Wc, Дж",
                    f: osc.capacitor_energy.bind(osc),
                    color: "green",
                })
            ]
        }),

        new FunctionGraphs({
            ctx: document.getElementById("charge").getContext("2d"),

            pos, size,

            max_value: osc.max_charge(),
            time_interval: PERIODS * period,
            period,

            functions: [
                new FunctionGraph({
                    label: "q, Кл",
                    f: osc.charge.bind(osc),
                    color: "blue",
                }),
            ]
        })
    ];

    interval_id = setInterval(() => {
        osc_ctx.clearRect(0, 0, 500, 500)

        time += DELTA_TIME;

        osc.update(time / 1000, DELTA_TIME / 1000)
        osc.draw(osc_ctx);

        graphs.forEach(graph => graph.draw(time))
    }, DELTA_TIME)
}

function stop() {
    clearInterval(interval_id);
}

control_button.onclick = () => {
    if (ongoing) {
        stop();
        control_button.textContent = "Старт";
    } else {
        start();
        control_button.textContent = "Стоп";
    }

    ongoing = !ongoing;
};