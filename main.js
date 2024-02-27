'use strict';
//zendure-solarflowXP Adapter for ioBroker
//REV 1.1.0
//Update to the last version of the ACTIVE SEND Protokoll 5.16
//Implements Power measurement with IN, OUT, BUS and DMX Ports
//Implements min max tracking of addition reads

//REV 1.0.2 First release
const adaptername = "zendure-solarflow"

const utils = require('@iobroker/adapter-core');
var adapter  = utils.Adapter (adaptername);


// --- Settings Variablen ---
var NAME = "Zendure";
var ClientID = "";
var Host = "mqtt.zen-iot.com";
var Port = 1883;
var UserName = "";
var PWD = "";


//*************************************  ADAPTER STARTS with ioBroker *******************************************
adapter.on ('ready',function ()
{
	adapter.setObjectNotExists ("Zendure",{
			type:'state',
			common:{name:'Test' ,type:'string',role:'value',read:true,write:true},
			native:{}
		});
	

	//Enable receiving of change events for all objects
	adapter.subscribeStates('*');
});

//************************************* ADAPTER CLOSED BY ioBroker *****************************************
adapter.on ('unload',function (callback){
	APPLICATIONstopp = true
	IS_ONLINE = false;
	clearInterval (OBJID_REQUEST);
	adapter.log.info ('zendure-solarflow: Close connection, cancel service');
	//client.close;
	callback;
	});


//************************************* Adapter STATE has CHANGED ******************************************	
adapter.on ('stateChange',function (id,obj){
	//adapter.log.info (id + "  /  "+obj);

	if (obj==null) {
		adapter.log.info ('Object: '+ id + ' terminated by user');
		return;
	}
		
	if (obj.from.search (adaptername) != -1) 
	{
		return;
	} 


/*
	var PORTSTRING = id.substring(adaptername.length+3);  				//remove Instance name
	// if (PORTSTRING[0] ='.'){PORTSTRING = id.substring(adaptername.length+4)};  optional removal if more than 10 Instances are used 
	//Statistic value´s are not processed
	if (PORTSTRING.search ('STAT_') > -1) {return;}
	//Reset of min max 
	if (PORTSTRING.search ('_reset') >-1)
	{
		var STATEname = PORTSTRING.replace ("_reset","");
		adapter.getState(STATEname , function (err, state) {	//get current value
			var newVAL =0;
			if (state !=null) {							//EXIT if state is not initialized yet
				if (state.val !=null) {					//Exit if value not initialized
					newVAL= state.val;
				}
			}
			adapter.setState(STATEname+'_min',newVAL,true);
			adapter.setState(STATEname+'_max',newVAL,true);
			adapter.setState(STATEname+'_reset',false,true);
			adapter.log.info ('Reset MIN / MAX of: ' + STATEname);
		});
		return;	
	}

	//Select the object type by the first character of the object name
	//'O' OUTPORT , 'D' DMX, 'B' BUSINPORT, INPORT and IR_RECEIVE cannot be set 
*/
/*	var PORTNUMBER =-1
	var WDATA 
	switch (PORTSTRING[0]) {
		case 'O':		//OUTPORT
			var PORTNUMBER = parseInt(PORTSTRING.substring(7));
			WDATA= Buffer.from ([0xF0,0x4F,(PORTNUMBER & 0xFF),0]);  // zendure-solarflow ACTIVE SEND Command switch Portnumber to OFF
			if (obj.val ==true) {WDATA[3] = 1;}						// IF TRUE then ON 
			client.write (WDATA); 
			break;
//REV 1.1 Upgrade auf 544 channels			
		case 'D':		//DMX CHANNEL
			var PORTNUMBER = parseInt(PORTSTRING.substring(3));
			WDATA= Buffer.from ([0xF0,0x44,((PORTNUMBER >> 8)&0xFF),(PORTNUMBER &0xFF),obj.val]);  // zendure-solarflow ACTIVE SEND Command SET DMX CHANNEL
			client.write (WDATA); 
			break;
		case 'B':	 	//BUS IO 
			var PORTNUMBER = parseInt(PORTSTRING.substring(3));
			PORTNUMBER+=24;
			WDATA= Buffer.from ([0xF0,0x4F,(PORTNUMBER & 0xFF),0]);  // zendure-solarflow ACTIVE SEND BUS IO
			if (obj.val ==true) {WDATA[3] = 1;}						// IF TRUE then ON 
			client.write (WDATA); 
			break;
		case 'S':  		//SCENE CALLED by the change of the object value 
			var SCENE_NUMBER = obj.val;
			if (SCENE_NUMBER < 1){return;}
			if (SCENE_NUMBER > 180){return;}
			WDATA= Buffer.from ([0xF0,0x53,SCENE_NUMBER]);  // zendure-solarflow ACTIVE SEND BUS IO
			client.write (WDATA); 
			break;
		
		case 'P':  		//PROGRAM CALLED by the change of the object value   
			var PG_NUMBER = obj.val;
			if (PG_NUMBER < 1){return;}
			if (PG_NUMBER > 28){return;}
			WDATA= Buffer.from ([0xF0,0x50,PG_NUMBER]);  // zendure-solarflow ACTIVE SEND BUS IO
			client.write (WDATA); 
			break;
		default:
			return;
			break;
	}
	*/
});


//************************************* TCP CONNECT /ERROR / CLOSED ****************************************
function CONNECT_CLIENT () {
	IS_ONLINE = false;
	adapter.log.info("Connecting zendure-solarflow controller " + IPADR + " "+ PORT);
	client.connect (PORT,IPADR);
}

//CLIENT SUCCESSFUL CONNECTED (CALLBACK from CONNECT_CLIENT)
function CBclientCONNECT () {
	//adapter.setState ('info.connection',true,true);
	adapter.log.info ('zendure-solarflow connection established');
	IS_ONLINE = true;
}

//CLIENT ERROR HANDLER AND CONNECTION RESTART
function CBclientERROR(Error) {
	IS_ONLINE = false;											//Flag Connection not longer online
	adapter.log.error ("Error zendure-solarflow connection: " + Error);	
	client.close;												//Close the connection
}
function CBclientCLOSED() {
	adapter.log.warn ("zendure-solarflow connection closed");
	if (APPLICATIONstopp ==false) {
		var RCTASK = setTimeout (CONNECT_CLIENT,30000);			//within 30 Sec.
		adapter.log.info ("Trying to reconnect in 30sec.");
	}
		
}


//************************************* TIMDED TASK requests additional ports and implements power measurement ****************
function CLIENT_REQUEST	(){
	if (IS_ONLINE == true) {
		if (EX_PTR >= EX_REQUEST_NAMES.length){EX_PTR =0;}   //RESET the POINTER if > array.length
		if (LOG_ALL) {adapter.log.info ("Request:" +EX_REQUEST_NAMES[EX_PTR])}
		var WDATA; 				//TX Buffer
		switch (EX_REQUEST_PORTS[EX_PTR]) {		//Position contains 'I' / 'B' / 'D' Inport , Bus, DMX
			
			case 'I':		//INPORT 1-24, create Request Command
				WDATA= Buffer.from ([0xF0,0x49,0x00,(EX_REQUEST_NUMBERS[EX_PTR] & 0xFF)]);
				client.write (WDATA); 
				break;
			
			case 'B':		//BUS 1-32
				var PNR = (EX_REQUEST_NUMBERS[EX_PTR] +24)//OFFSET BUS same Command but Numbers 25 to 56
				WDATA= Buffer.from ([0xF0,0x49,0x00,PNR]);
				client.write (WDATA); 
				break;
			
			case 'D':		//DMX 1-544
				var PNR = (EX_REQUEST_NUMBERS[EX_PTR] +256)//OFFSET DMX =256 --> 0x0101 to 0x320 max
				WDATA= Buffer.from ([0xF0,0x49,((PNR >> 8) & 0xFF),(PNR & 0xFF)]);
				client.write (WDATA); 
				break;
			case 'C':		//CHARBUFFER 1-8, create Request Command
				var PNR = (EX_REQUEST_NUMBERS[EX_PTR] +0xE0)//OFFSET CHAR BUFFER same Command PORT REQUEST
				WDATA= Buffer.from ([0xF0,0x49,0x00,PNR]);
				client.write (WDATA); 
				break;
			default:
				return;
				break;
		}
		EX_PTR+=1;    //next pointer 
		
		//Power Calculation  log("Gerät Nr. " + i + ": " + getObject(id).name + ": " + status);
		for (var i=0;i< PW_REQUEST_NAMES.length;i++){
			POWERmeasure(i);
		}
	}
}

//Updates the Power value of an channel by the Index of PW_REQUEST_NAMES
function POWERmeasure (i){
	var IDread = adapter.name + '.' + adapter.instance + "." +PW_REQUEST_NAMES[i];
	var IDout = adapter.name + '.' + adapter.instance + "." +PW_REQUEST_OUTPUT[i];
	var IDruntime = adapter.name + '.' + adapter.instance + "." +PW_REQUEST_RUNTIME[i];
	var POWERtoADD = PW_REQUEST_KW[i];
	var PW_bool = PW_REQUEST_BOOL[i];
	var ADDTIME = parseFloat(TIMING)/(1000*3600);
	//get the current state of the port, if port state not exists --> exit
	adapter.getState(IDread, function (err, state) {
		if (state ==null) {return;}							//EXIT if state is not initialized yet
		if (state.val ==null) {return;}						//Exit if value not initialized
		var CURRENT_VALUE = state.val;
		//if port is true or >0 do the powercalculation and runtime adding
		if (CURRENT_VALUE)
			{
			//Power consumtion processing only if load value exists
			if (POWERtoADD >0)
			{
				adapter.getState(IDout, function (err, state) {
					var POWERvalue = 0;
					if (state != null){if (state.val !=null){POWERvalue =  parseFloat(state.val);}}

					if (PW_bool){
						POWERvalue+=POWERtoADD;
					} else {
						POWERvalue+=POWERtoADD*CURRENT_VALUE/255;
					}
					adapter.setState(IDout,POWERvalue,true);
				});	
			}			
			//Get current runtime value, if not exists, create with 0
			adapter.getState(IDruntime, function (err, state) {
				var newRUNTIME = 0;
				if (state != null){if (state.val !=null){newRUNTIME =  parseFloat(state.val);}}
				newRUNTIME+= ADDTIME;
				adapter.setState(IDruntime,newRUNTIME,true);
			});	

		}
	});
	return;
}




//************************************* PROCESSING ASYNCHRON RECEIVED DATA FROM zendure-solarflow ******************************************
function CBclientRECEIVE(RXdata) {
	if (RXdata.length < 3) {return;}			// Minimum Length of response ist start 0xF0, Signature 0xnn and at least one data byte 
	
	if (RXdata[0] != 0xF0) {					// CHECK START BYTE =0xF0
		return;
	}
	var i;
	var x;	
	
	switch (RXdata[1]) {
		case 0x01:			// IR CODE 10 Bytes received, 8 Bytes IR Code
			if (RXdata.length == 10){    
				var BUFF = "";
				var IRCODE = "";
				for (i=2;i<10;i++){
					BUFF = RXdata[i].toString(16).toUpperCase();
					//BUFF = BUFF.toUpperCase;
					if (BUFF.length <2) {IRCODE += '0'+BUFF} else {IRCODE += BUFF}
				}
				adapter.setState('IR_RECEIVE',IRCODE,false);
			}
			
			break;

		case 0x02:   		//RECEIVING INPORT STATE INFO //9 Bytes RX length
			if (RXdata.length == 9){    
				var ONOFF = false;
				x =1;
				for (i=1;i<0x81;i*=2){
					if (i & RXdata[8]){ONOFF = true;} else {ONOFF = false;}
					adapter.setState(GetIN(x),ONOFF);
					if (i & RXdata[7]){ONOFF = true;} else {ONOFF = false;}
					adapter.setState(GetIN(x+8),ONOFF);
					//if (i & RXdata[6]){ONOFF = true;} else {ONOFF = false;}
					//adapter.setState(GetIN(x+16),ONOFF);
					if (i & RXdata[5]){ONOFF = true;} else {ONOFF = false;}
					adapter.setState(GetBUS(x),ONOFF);
					if (i & RXdata[4]){ONOFF = true;} else {ONOFF = false;}
					adapter.setState(GetBUS(x+8),ONOFF);
					if (i & RXdata[3]){ONOFF = true;} else {ONOFF = false;}
					adapter.setState(GetBUS(x+16),ONOFF);
					if (i & RXdata[2]){ONOFF = true;} else {ONOFF = false;}
					adapter.setState(GetBUS(x+24),ONOFF);
					x+=1;
				}
			}
			break;
		
		case 0x04:	//OUTPORT  //5 Bytes RX length
			var ONOFF = false;
			if (RXdata.length == 5){   
				x =1;
				for (i=1;i<0x81;i*=2){
					if (i & RXdata[4]){ONOFF = true;} else {ONOFF = false;}
					adapter.setState(GetOUT(x),ONOFF);
					if (i & RXdata[3]){ONOFF = true;} else {ONOFF = false;}
					adapter.setState(GetOUT(x+8),ONOFF);
					x+=1;
				}
			}
			break;
		
		case 0x49: //AD INPORT REQUEST RETURN  0xF0,0x49,PORTNR_HIGH,PORTNR LOW , bDIGITAL VALUE, bANALOG VALUE, 'TEXT VALUE eg. 34.55 GRAD'
			//EXTRACT PORT and Float value, write it to the coreesponding object if exists
			if (RXdata.length > 8){   
				var exFLOAT = 0;				//Resulting float Value 
				var exNUMBER = (RXdata[2]*256)+ RXdata[3]		//PORT NUMBER  1-24 INPORTS 1-24
																//25-56 BUS 1-32
				var exPORTS = '';							    //0x101-0x320 DMX 1-544
				var exNAME ='';
				if (exNUMBER > 0 && exNUMBER <=24) {				
					exPORTS ='I';							// INPORT
					exNAME = "VALUE_" + GetIN(exNUMBER);	// OBJECT NAME
				}
				if (exNUMBER >=25 && exNUMBER <=56) {				
					exNUMBER-=24;							// REMOVE OFFSET
					exPORTS ='B';							// BUS PORT
					exNAME = "VALUE_" + GetBUS(exNUMBER);	// OBJECT NAME
				}
				//UPGRADE REV 1.1  CHAR BUFFER REQUESTS valid from zendure-solarflow Firmware 5.17
				if (exNUMBER >=0xE1 && exNUMBER <=0xE8) {				
					exNUMBER-=0xE0;							// REMOVE OFFSET
					exPORTS ='C';							// BUS PORT
					exNAME = "VALUE_" + GetCHARBUFFER(exNUMBER);	// OBJECT NAME
				}
				
				if (exNUMBER >=257 && exNUMBER <=481) {				
					exNUMBER-=256;							// REMOVE OFFSET
					exPORTS ='D';							// BUS PORT
					exNAME = "VALUE_" + GetDMX(exNUMBER);	// OBJECT NAME
				}
				if (exNAME.length==0){return;}				//EXIT if portnumber not applicable
				// get the value string out of RX from pos 6++	
				var strVALUE='';			
				for (i=6;i< RXdata.length;i++){
					strVALUE+=String.fromCharCode (RXdata[i]);
					}	
				//Replace "," to "." and convert to float
				exFLOAT = parseFloat (strVALUE.replace (",","."));
				//Transfer to OBJECT
				if (LOG_ALL){adapter.log.info ("RX: " + exNAME + " DATA:" + exFLOAT)};
				adapter.setState(exNAME,exFLOAT);
				
				if (EX_MINMAX_TRACKING) {
				
					//SET / READ the min /max value for this object, if null set to initial value
					var MIN_CURRENT;
					adapter.getState(exNAME+"_min", (err, state) => 
						{if (state==null) 
							{adapter.setState(exNAME+"_min",exFLOAT);} 
						else 
							{
								if (exFLOAT < state.val){adapter.setState(exNAME+"_min",exFLOAT);}
							}
						}
						);
					var MAX_CURRENT;
					adapter.getState(exNAME+"_max", (err, state) => 
						{if (state==null) 
							{adapter.setState(exNAME+"_max",exFLOAT);} 
						else 
							{
								if (exFLOAT > state.val){adapter.setState(exNAME+"_max",exFLOAT);}
							}
						}
						);
				}
				
			}
			break;
		
		case 0xFF:	//DMX OUT DATA
			var USED_DXMOUT = (RXdata.length-2);
			if (DMX_CHANNELS_USED < USED_DXMOUT) {
				USED_DXMOUT = DMX_CHANNELS_USED;
				}
			
			for (i=1;i <= USED_DXMOUT;i++){
				adapter.setState(GetDMX(i),RXdata[i+1]);				
				}
			break;
			
			
		default:
			return;
			break;
	}

	
}

//************************************* Other support functions *************************************************
function GetDMX (number){
	if (number <10) {return 'DMX00'+number;}
	if (number <100) {return 'DMX0'+number;}
	return 'DMX'+number;
}
function GetOUT (number){
	if (number <10) {return 'OUTPORT0'+number;}
	return 'OUTPORT'+number;
}
function GetIN (number){
	if (number <10) {return 'INPORT0'+number;}
	return 'INPORT'+number;
}
function GetBUS (number){
	if (number <10) {return 'BUS0'+number;}
	return 'BUS'+number;
}
//Rev 1.1 added for char Buffers
function GetCHARBUFFER (number){
	if (number <10) {return 'CHAR0'+number;}
	return 'CHAR'+number;
}




