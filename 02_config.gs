function isNight(){
  var h = new Date().getHours();
  return (h >= 22 || h < 7);
}

// ✅ WEEKEND + FESTIVI
function isFestivo(){

  var d = new Date();
  var day = d.getDay();

  // WEEKEND
  if(day === 0 || day === 6){
    return true;
  }

  var dd = ("0" + d.getDate()).slice(-2);
  var mm = ("0" + (d.getMonth()+1)).slice(-2);

  var today = dd + "/" + mm;

  // ✅ FESTIVI ITALIA (base)
  var holidays = [
    "01/01", // Capodanno
    "06/01", // Epifania
    "25/04", // Liberazione
    "01/05", // Lavoro
    "02/06", // Repubblica
    "15/08", // Ferragosto
    "01/11", // Ognissanti
    "08/12", // Immacolata
    "25/12", // Natale
    "26/12"  // Santo Stefano
  ];

  return holidays.indexOf(today) !== -1;
}
