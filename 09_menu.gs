// 09_menu.gs — menu Utility + diagnostica

function onOpen(){
  SpreadsheetApp.getUi().createMenu('Utility')
    .addItem('Elenca trigger','diag_listTriggers_')
    .addItem('Purge + Ensure + Eval','_LAUNCH_RESET_AND_ENSURE_')
    .addSeparator()
    .addItem('FORZA IN (scegli nome…)','_menuForceInPrompt_')
    .addItem('FORZA OUT (scegli nome…)','_menuForceOutPrompt_')
    .addSeparator()
    .addItem('ALZA ora (tapparelle)','_menuRaiseNow_')
    .addItem('ABBASSA ora (tapparelle)','_menuLowerNow_')
    .addSeparator()
    .addItem('PIANTE - Avvia ora','pianteStartNow_')
    .addItem('PIANTE - Annulla pianificazioni','pianteCancelPlanned_')
    .addItem('PIANTE - Diagnostica prossimo run','pianteDiagNext_')
    .addSeparator()
    .addItem('Diagnostica completa','diag_fullSystemTest_')
    .addSeparator()
    .addItem('🏠 Setup Cruscotto + Pulizia fogli','setupAll_')
    .addSeparator()
    .addItem('Legenda Utility…','menuShowUtilityLegend_')
    .addToUi();
}

function _menuForceInPrompt_(){
  var ui=SpreadsheetApp.getUi();
  var r=ui.prompt('FORZA IN','Nome:',ui.ButtonSet.OK_CANCEL);
  if(r.getSelectedButton()!==ui.Button.OK) return;
  var who=String(r.getResponseText()||'').trim().toLowerCase();
  try{ var res=forceIn_(who); evaluateStateNow(); ui.alert('FORZA IN ('+who+'): '+(res&&res.ok?'OK':'KO')); }
  catch(e){ ui.alert('ERR: '+e); }
}

function _menuForceOutPrompt_(){
  var ui=SpreadsheetApp.getUi();
  var r=ui.prompt('FORZA OUT','Nome:',ui.ButtonSet.OK_CANCEL);
  if(r.getSelectedButton()!==ui.Button.OK) return;
  var who=String(r.getResponseText()||'').trim().toLowerCase();
  try{ var res=forceOut_(who); evaluateStateNow(); ui.alert('FORZA OUT ('+who+'): '+(res&&res.ok?'OK':'KO')); }
  catch(e){ ui.alert('ERR: '+e); }
}

function _menuRaiseNow_(){
  try{ raiseAllNow_('menu'); SpreadsheetApp.getUi().alert('ALZA → OK'); }
  catch(e){ SpreadsheetApp.getUi().alert('ALZA ERR: '+e); }
}
function _menuLowerNow_(){
  try{ lowerAllNow_('menu'); SpreadsheetApp.getUi().alert('ABBASSA → OK'); }
  catch(e){ SpreadsheetApp.getUi().alert('ABBASSA ERR: '+e); }
}

function diag_listTriggers_(){
  var ts=ScriptApp.getProjectTriggers().map(function(t){ return t.getHandlerFunction?t.getHandlerFunction():'?'; });
  SpreadsheetApp.getUi().alert('Trigger attivi ('+ts.length+'):\n\n'+(ts.length?ts.join('\n'):'(nessuno)'));
}

function diag_fullSystemTest_(){
  var ui=SpreadsheetApp.getUi();
  try{
    var ppl=getPeople_().people||[];
    var pplStr=ppl.map(function(p){
      return p.name+':'+(p.online?'IN':'OUT')+
        (hasSsidLock_(p.name.toLowerCase())?' [SSID]':'');
    }).join('\n  ');
    var ts=ScriptApp.getProjectTriggers().map(function(t){ return t.getHandlerFunction?t.getHandlerFunction():'?'; });
    var alba=v('Stato','B3'), tram=v('Stato','B4');
    var tz=Session.getScriptTimeZone();
    var msg=
      '=== STATO SISTEMA ===\n'+
      'Ora: '+new Date().toISOString()+'\n'+
      'isNight: '+(isNight()?'SI':'NO')+'\n'+
      'Profilo: '+getStatoCorrente_()+'\n'+
      'Vacanza: '+(isVacanza_()?'SI':'NO')+'\n'+
      'Override: '+(isOverride_()?'SI ⚠️':'NO')+'\n'+
      'Presenza eff: '+(v('Config','B6')?'SI':'NO')+'\n'+
      'Alba: '+(alba instanceof Date?Utilities.formatDate(alba,tz,'HH:mm'):'—')+
      '  Tramonto: '+(tram instanceof Date?Utilities.formatDate(tram,tz,'HH:mm'):'—')+'\n\n'+
      'Persone ('+ppl.length+'):\n  '+pplStr+'\n\n'+
      'Trigger attivi ('+ts.length+'):\n  '+ts.join('\n  ');
    ui.alert(msg);
    logEvent('DIAG_FULL','ok','');
  }catch(e){ ui.alert('DIAG ERR: '+e); }
}

function menuShowUtilityLegend_(){
  SpreadsheetApp.getUi().alert(
    "LEGENDA MENU UTILITY\n\n"+
    "• Purge + Ensure + Eval → Reset completo trigger (5 fissi) + eval immediata\n"+
    "• FORZA IN → IN manuale + clear pending\n"+
    "• FORZA OUT → OUT manuale\n"+
    "• ALZA/ABBASSA ora → Tapparelle immediate\n"+
    "• PIANTE → Avvia/annulla/diagnostica irrigazione\n"+
    "• Diagnostica completa → Snapshot stato + persone + trigger\n\n"+
    "4 COMANDI iOS:\n"+
    "  ssid_on  → IN immediato (hold=480min)\n"+
    "  ssid_off → solo log, NON cambia stato\n"+
    "  mark_out → OUT immediato (geofence)\n"+
    "  mark_in  → IN immediato (geofence)\n\n"+
    "NESSUN auto-out, NESSUN timeout, NESSUN KA"
  );
}
