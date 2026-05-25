// ============================================================
// 09_menu.gs — menu Utility + diagnostica
// ============================================================

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
    .addItem('Mostra cooldown…','diag_showCooldownPrompt_')
    .addItem('Azzera cooldown…','diag_clearCooldownPrompt_')
    .addItem('Imposta cooldown (+X min)…','diag_setCooldownPrompt_')
    .addSeparator()
    .addItem('Diagnostica completa','diag_fullSystemTest_')
    .addSeparator()
    .addItem('Legenda Utility…','menuShowUtilityLegend_')
    .addToUi();
}

function _menuForceInPrompt_(){
  var ui=SpreadsheetApp.getUi();
  var r=ui.prompt('FORZA IN','Nome:',ui.ButtonSet.OK_CANCEL);
  if(r.getSelectedButton()!==ui.Button.OK)return;
  var who=String(r.getResponseText()||'').trim().toLowerCase();
  try{ var res=forceIn_(who); evaluateStateNow(); ui.alert('FORZA IN ('+who+'): '+(res&&res.ok?'OK':'KO')); }
  catch(e){ ui.alert('ERR: '+e); }
}

function _menuForceOutPrompt_(){
  var ui=SpreadsheetApp.getUi();
  var r=ui.prompt('FORZA OUT','Nome:',ui.ButtonSet.OK_CANCEL);
  if(r.getSelectedButton()!==ui.Button.OK)return;
  var who=String(r.getResponseText()||'').trim().toLowerCase();
  try{ var res=markOutNow_(who); evaluateStateNow(); ui.alert('FORZA OUT ('+who+'): '+(res&&res.ok?'OK':'KO')); }
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

// ---------- Cooldown diagnostica ----------
function diag_listTriggers_(){
  var ts=ScriptApp.getProjectTriggers().map(function(t){ return t.getHandlerFunction?t.getHandlerFunction():'?'; });
  SpreadsheetApp.getUi().alert('Trigger attivi ('+ts.length+'):\n\n'+(ts.length?ts.join('\n'):'(nessuno)'));
}

function diag_showCooldownPrompt_(){
  var ui=SpreadsheetApp.getUi();
  var r=ui.prompt('Mostra cooldown','Nome:',ui.ButtonSet.OK_CANCEL);
  if(r.getSelectedButton()!==ui.Button.OK)return;
  var nm=String(r.getResponseText()||'').trim().toLowerCase();
  var until=getCooldown_(nm);
  ui.alert('Cooldown '+nm+':\n'+(until?('fino al '+new Date(until).toISOString()):'(nessuno)')+'\nOra: '+new Date().toISOString());
}
function diag_clearCooldownPrompt_(){
  var ui=SpreadsheetApp.getUi();
  var r=ui.prompt('Azzera cooldown','Nome:',ui.ButtonSet.OK_CANCEL);
  if(r.getSelectedButton()!==ui.Button.OK)return;
  clearCooldown_(String(r.getResponseText()||'').trim().toLowerCase());
  ui.alert('Cooldown azzerato.');
}
function diag_setCooldownPrompt_(){
  var ui=SpreadsheetApp.getUi();
  var r1=ui.prompt('Imposta cooldown','Nome:',ui.ButtonSet.OK_CANCEL);
  if(r1.getSelectedButton()!==ui.Button.OK)return;
  var nm=String(r1.getResponseText()||'').trim().toLowerCase();
  var r2=ui.prompt('Imposta cooldown','Minuti:',ui.ButtonSet.OK_CANCEL);
  if(r2.getSelectedButton()!==ui.Button.OK)return;
  var mins=Number(r2.getResponseText()||'0');
  var until=Date.now()+mins*60000;
  setCooldown_(nm,until);
  logEvent('COOLDOWN_SET_MANUAL',nm,mins+'m');
  ui.alert('Cooldown '+nm+': '+new Date(until).toISOString());
}

// ---------- Test completo ----------
function diag_fullSystemTest_(){
  var ui=SpreadsheetApp.getUi();
  try{
    var ppl=getPeople_().people||[];
    var pplStr=ppl.map(function(p){ return p.name+':'+(p.online?'IN':'OUT')+(p.tsText?' ('+p.tsText+')':''); }).join('\n  ');
    var ts=ScriptApp.getProjectTriggers().map(function(t){ return t.getHandlerFunction?t.getHandlerFunction():'?'; });
    var msg=
      '=== STATO SISTEMA ===\n'+
      'Ora: '+new Date().toISOString()+'\n'+
      'Profilo: '+getStatoCorrente_()+'\n'+
      'Notte: '+(isNight()?'SI':'NO')+'\n'+
      'Vacanza: '+(isVacanza_()?'SI':'NO')+'\n'+
      'Override: '+(isOverride_()?'SI (ATTENZIONE!)':'NO')+'\n'+
      'Presenza eff: '+(v('Config','B6')?'SI':'NO')+'\n\n'+
      'Persone ('+ppl.length+'):\n  '+pplStr+'\n\n'+
      'Trigger attivi ('+ts.length+'):\n  '+ts.join('\n  ')+'\n\n'+
      'STRICT_LIFE: '+getStrictLifeMin_()+'m\n'+
      'LIFE_TIMEOUT: '+getLifeTimeoutMin_()+'m + buffer '+getIftttBufferMin_()+'m\n'+
      'EXIT_COOLDOWN: '+getExitCooldownMin_()+'m\n'+
      'EXIT_GUARD: '+getExitGuardMin_()+'m';
    ui.alert(msg);
    logEvent('DIAG_FULL','ok',msg.substring(0,200));
  }catch(e){ ui.alert('DIAG ERR: '+e); }
}

function menuShowUtilityLegend_(){
  SpreadsheetApp.getUi().alert(
    "LEGENDA MENU UTILITY\n\n"+
    "• Purge + Ensure + Eval → Reset completo trigger + eval immediata\n"+
    "• FORZA IN → Simula arrivo manuale\n"+
    "• FORZA OUT → Simula uscita manuale con cooldown\n"+
    "• ALZA/ABBASSA ora → Tapparelle immediate\n"+
    "• PIANTE → Avvia/annulla/diagnostica irrigazione\n"+
    "• Cooldown → Mostra/azzera/imposta cooldown per nome\n"+
    "• Diagnostica completa → Snapshot stato + persone + trigger\n\n"+
    "PARAMETRI CHIAVE (Config sheet):\n"+
    "B9  = STRICT_LIFE_MIN (ping recente per considerarsi IN di giorno)\n"+
    "B12 = EXIT_GUARD_MIN (delay dopo SSID OFF prima di OUT)\n"+
    "B13 = EXIT_CONFIRM_MIN (se ping recente annulla pending OUT)\n"+
    "B15 = LIFE_TIMEOUT_MIN (timeout life ping → auto OUT)\n"+
    "B25 = IFTTT_BUFFER_MIN (buffer extra su timeout, default 8)\n"+
    "B26 = EXIT_COOLDOWN_MIN (cooldown post-uscita, default 15)\n"+
    "B30 = ALZA_CON (ARRIVO/PIANTE/MAI)"
  );
}
