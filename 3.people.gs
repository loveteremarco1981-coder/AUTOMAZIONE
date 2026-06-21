function setPerson(name,state){

  var shP = sh('Persone');

  for(var i=2;i<=shP.getLastRow();i++){

    if(
      String(shP.getRange(i,1).getValue())
      .toLowerCase() === name
    ){

      shP.getRange(i,3).setValue(
        Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          'dd/MM/yyyy HH:mm:ss'
        )
      );

      shP.getRange(i,4).setValue(state);

      return;
    }
  }
}

function isAnyoneInside(){

  var shP = sh('Persone');

  var lastRow = shP.getLastRow();

  if(lastRow < 2){
    return false;
  }

  var d =
    shP.getRange(
      2,
      1,
      lastRow - 1,
      4
    ).getValues();

  for(var i=0;i<d.length;i++){

    if(
      String(d[i][3])
      .toUpperCase() === 'IN'
    ){
      return true;
    }
  }

  return false;
}
