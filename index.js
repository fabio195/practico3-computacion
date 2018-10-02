// Muñoz, Fabio Nahuel
// Computación en la nube - 2018
//
var AWS = require('aws-sdk');
var handler = function(event, context, callback) {
	var dynamodb = new AWS.DynamoDB({
		apiVersion: '2012-08-10',
		endpoint: 'http://dynamodb:8000',
		region: 'us-west-2',
		credentials: {
			accessKeyId: '2345',
			secretAccessKey: '2345'
		}
	});
	var docClient = new AWS.DynamoDB.DocumentClient({
		apiVersion: '2012-08-10',
		service: dynamodb
	});
	let id = (event.pathParameters || {}).idEnvio || false;
	switch(event.httpMethod) {
		case "GET":
			switch(event.path){
				case "/envios/"+id:
					if (id){
						var paramsGetId = {
						    TableName: 'Envio',
    						Key: {
        						"id": id,
    						},
						};
						docClient.get(paramsGetId, function(err, data){
							if (err) callback(null, {body: "GET Envio por id falló " + JSON.stringify(err), statusCode:500});
							else {
								var itemGet = JSON.stringify(data.Item)
								callback(null, {body: "Envio id " + id + ": " + itemGet, statusCode: 200});
							};
						});
						return;
					}
					console.log("Metodo no soportado (" + event.httpMethod+ ")" + event.path);
					callback(null, { statusCode: 501 });
					break;
				case "/envios/pendientes":
					var paramsPend = {
    					TableName: 'Envio',
    					FilterExpression: 'attribute_exists(pendiente)',
					};
					dynamodb.scan(paramsPend, function(err, data) {
    					if (err) callback(null, {body: "GET Envios pendientes falló " + JSON.stringify(err), statusCode:500});
						else callback(null, {body: "Envios pendientes: " + JSON.stringify(data), statusCode: 201});
					});
					return;
				default:
					console.log("Metodo no soportado (" + event.httpMethod+ ")" + event.path);
					callback(null, { statusCode: 501 });
			}

		case "POST":
			switch(event.path){
				case "/crear":
					crear(dynamodb)
					callback(null, {statusCode: 201});
					return;
				case "/envios":
					var item = JSON.parse(event.body)
					item.fechaAlta = new Date().toISOString();
					item.pendiente = item.fechaAlta;
					item.id = guid();

					let paramsPost = {
						"TableName": "Envio",
						"Item": item
					};
					docClient.put(paramsPost, function(err, data) {
						if (err)  callback(null, {body: "POST envio sin movimiento falló" + JSON.stringify(err), statusCode: 500}); 
						else callback(null, {body: "POST envio sin movimiento " + JSON.stringify(item), statusCode: 200});
					});
					return;
				case "/envios/"+id+"/movimiento":
					if (id){
						var paramsMov = {
						    TableName: 'Envio',
    						Key: {
        						"id": id,
    						},
						};
						docClient.get(paramsMov, function(err, data) {
    						if (err) callback(null, {body: "POST Movimiento de Envio falló " + JSON.stringify(err), statusCode: 500});
    						else {
    							var itemEntr = data.Item
    							var movimiento = JSON.parse(event.body)
    							movimiento.fecha = new Date().toISOString();
    							if (itemEntr.historial==undefined){
    								itemEntr.historial = new Array();
    							};
    							itemEntr.historial.push(movimiento);

    							var paramsMovUpdate = {
    								"TableName": "Envio",
    								"Item": itemEntr,
    							};
    							docClient.put(paramsMovUpdate, function(err, data) {
									if (err)  callback(null, {body: "POST Movimiento de Envio falló" + JSON.stringify(err), statusCode: 500}); 
									else callback(null, {body: "POST Movimiento exitoso: " + JSON.stringify(itemEntr), statusCode: 200});
								});

    							callback(null, {body: JSON.stringify(itemEntr), statusCode:200});
    						};
						});
						return;
					}
					console.log("Metodo no soportado (" + event.httpMethod+ ")" + event.path);
					callback(null, { statusCode: 501 });
					break;
				case "/envios/"+id+"/entregado":
					if (id){
						var paramsEntr = {
						    TableName: 'Envio',
    						Key: {
        						"id": id,
    						},
						};
						docClient.get(paramsEntr, function(err, data) {
    						if (err) callback(null, {body: "POST Envio marcado como entregado falló " + JSON.stringify(err), statusCode: 500});
    						else {
    							var itemEntr = data.Item
    							itemEntr.pendiente = undefined

    							var paramsEntrUpdate = {
    								"TableName": "Envio",
    								"Item": itemEntr,
    							};
    							docClient.put(paramsEntrUpdate, function(err, data) {
									if (err)  callback(null, {body: "POST Envio marcado como entregado falló" + JSON.stringify(err), statusCode: 500}); 
									else callback(null, {body: "POST Envio " + id + " entregado", statusCode: 200});
								});
    						};
						});
						return;
					}
					console.log("Metodo no soportado (" + event.httpMethod+ ")" + event.path);
					callback(null, { statusCode: 501 });
					break;
				default:
					console.log("Metodo no soportado (" + event.httpMethod+ ")" + event.path);
					callback(null, { statusCode: 501 });
			}

		default:
			console.log("Metodo no soportado (" + event.httpMethod+ ")");
			callback(null, { statusCode: 501 });
	}
}

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function crear(dynamodb) {
	var params_crear = {
		TableName: "Envio",
		KeySchema: [
			{ AttributeName: "id", KeyType: "HASH" }
		],
		AttributeDefinitions: [
			{ AttributeName: "id", AttributeType: "S" },
			{ AttributeName: "pendiente", AttributeType: "S" }
		],
		GlobalSecondaryIndexes: [
		{
			IndexName: "EnviosPendientesIndex",
			KeySchema: [
				{ AttributeName: "id", KeyType: "HASH" },
				{ AttributeName: "pendiente", KeyType: "RANGE" }
			],
			Projection: {
				ProjectionType: "KEYS_ONLY"
			},
		ProvisionedThroughput: {
			ReadCapacityUnits: 10,
			WriteCapacityUnits: 10
			}
		}
  		],
		ProvisionedThroughput: {
			ReadCapacityUnits: 10,
			WriteCapacityUnits: 10
		}
	};

	dynamodb.createTable(params_crear, function(err, data) {
	if (err) {
		console.log("Error", err.code);
	} else {
		console.log("Tabla creada");
	}
});

}


exports.handler = handler;