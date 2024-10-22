const axios = require('axios');
const redis = require('redis');
const client = redis.createClient(); // creates a new client
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const helmet = require('helmet');

const app = express();

// Use Helmet to secure Express apps
app.use(helmet());

app.use(express.static(path.join(__dirname, 'www')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

client.on('connect', function () {
    console.log('connected');
});

client.on("error", function (err) {
    console.log("Error on redis " + err);
});

app.post('/payment', (req, res) => {
    const request = require('request');
    let amount = +req.query.amount;
    console.log('Amount original', amount);
    amount = Math.round(amount * 100);
    console.log('Amount after round', amount);
    console.log('Amount of charge', amount);
    const dataString = `amount=${amount}&currency=eur&description=${req.query.description}&source=${req.query.token}`;
    
    console.log(req.query.amount);
    const options = {
        url: 'https://api.stripe.com/v1/charges',
        method: 'POST',
        body: dataString,
        auth: {
            user: '', // 'user': removed key
            pass: ''
        }
    };

    function callback(error, response, body) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        if (!error && response.statusCode === 200) {
            console.log(body);
            res.send(body);
        } else {
            res.status(400);
            res.send(body);
        }
    }

    request(options, callback);
});

app.post('/api/checkout', async function (req, res) {
    const orderBody = req.body;
    const auth = {
        username: '', // removed
        password: '' // removed
    };
    const api_url = 'https://api.klarna.com/checkout/v3/orders';
    const products = [];
    const merchant = {
        terms: 'https://fruudo.com/terms-conditions',
        checkout: 'https://fruudo.com/checkout',
        confirmation: 'https://fruudo.com/api/klarna/confirm?oid={checkout.order.id}',
        push: 'https://fruudo.com/api/klarna/push?oid={checkout.order.id}'
    };

    for (const item of orderBody.dishes) {
        products.push({
            name: item.name,
            quantity: item.quantity,
            unit_price: (+orderBody.total * 100),
            tax_rate: 0,
            total_amount: (+orderBody.total * 100),
            total_tax_amount: 0,
        });
    }

    const order = {
        order_id: orderBody._id,
        name: 'Fruudo',
        purchase_country: 'FI',
        purchase_currency: 'EUR',
        locale: 'en-US',
        order_amount: (+orderBody.total * 100),
        order_tax_amount: 0,
        order_lines: products,
        merchant_urls: merchant,
    };

    try {
        const response = await axios.post(api_url, order, { auth });
        console.log("All ok at klarna", response.data);
        client.set('ORDER:' + orderBody._id, JSON.stringify(response.data));
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        res.status(200).send({ status: 1, result: 'All good!' });
    } catch (e) {
        console.log('Got this error from klarna', e);
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        res.send({ status: -1, result: 'Unable to start payment!' });
    }
});

// Remaining routes...

app.get('*', function (req, res) {
    res.sendFile(path.join(__dirname, 'www/index.html'));
});

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, sessionStoreService, x-session-token");
    next();
});

app.listen(8000);
