;;; ==========================================================================
;;; LPS.lsp - Progettazione LPS (protezione contro i fulmini)
;;; Compatibile: ZWCAD 2025 e AutoCAD (completo; LT dalla 2024 senza solidi 3D)
;;;
;;; Comandi
;;;   LPS            elenco dei comandi
;;;   LPS-IMPORTA    disegna in 3D il progetto esportato dal sito (file .lpsdati)
;;;   LPS-SFERA      disegna la sfera rotolante di un livello in un punto
;;;   LPS-ESPORTA    esporta i contorni dell'edificio verso il sito (edificio_da_CAD.json)
;;;   LPS-DISTINTA   distinta dei componenti disegnati (codici OBO, pezzi e metri) + CSV
;;;   LPS-BLOCCHI    imposta la cartella dei blocchi OBO (file <codice>.dwg)
;;;
;;; Il file .lpsdati ha un record LISP per riga, con coordinate in metri:
;;; il comando converte nelle unita' del disegno (INSUNITS).
;;; ==========================================================================

(setq *LPS-VERSIONE* "1.0")
(if vl-load-com (vl-load-com))

;;; --------------------------------------------------------------------------
;;; Impostazioni
;;; --------------------------------------------------------------------------

;; raggi della sfera rotolante per livello (m) - da allineare a parametriLPL.json
(setq *LPS-RAGGI* '(("I" . 20.0) ("II" . 30.0) ("III" . 45.0) ("IV" . 60.0)))

;; lunghezza di un elemento di picchetto componibile (m)
(if (not *LPS-ELEMENTO-PICCHETTO*) (setq *LPS-ELEMENTO-PICCHETTO* 1.5))

;; unita' in cui sono disegnati i blocchi OBO (1000 = millimetri, 1 = metri)
(if (not *LPS-UNITA-BLOCCHI*) (setq *LPS-UNITA-BLOCCHI* 1000.0))

;; layer: nome, colore
(setq *LPS-LAYER*
  '(("EDIFICIO" "LPS_EDIFICIO" 8)
    ("ASTE" "LPS_CAPTAZIONE_ASTE" 1)
    ("CAPTAZIONE" "LPS_CAPTAZIONE_CONDUTTORI" 1)
    ("CALATA" "LPS_CALATE" 3)
    ("TERRA" "LPS_TERRA" 32)
    ("SUPPORTI" "LPS_SUPPORTI" 5)
    ("MORSETTI" "LPS_MORSETTI" 6)
    ("TESTI" "LPS_TESTI" 7)
    ("ESPOSTO" "LPS_ESPOSTO" 10)
    ("SFERA" "LPS_SFERA" 4)))

;;; --------------------------------------------------------------------------
;;; Utilita'
;;; --------------------------------------------------------------------------

(defun lps:msg (s) (princ (strcat "\n" s)) (princ))

;; T se il CAD sa creare solidi 3D (AutoCAD LT no)
(defun lps:solidi-p (/ p)
  (setq p (getvar "PRODUCT"))
  (not (and p (wcmatch (strcase p) "*LT*"))))

;; fattore metri -> unita' del disegno
(defun lps:fattore (/ u k)
  (setq u (getvar "INSUNITS"))
  (cond
    ((= u 6) 1.0)
    ((= u 4) 1000.0)
    ((= u 5) 100.0)
    ((= u 14) 10.0)
    (T
     (initget "Metri Millimetri Centimetri")
     (setq k (getkword "\nUnita' del disegno [Metri/Millimetri/Centimetri] <Metri>: "))
     (cond ((= k "Millimetri") 1000.0) ((= k "Centimetri") 100.0) (T 1.0)))))

;; nome del layer per una chiave di *LPS-LAYER*, creato se manca
(defun lps:layer (chiave / d nome)
  (setq d (assoc chiave *LPS-LAYER*))
  (setq nome (if d (cadr d) (strcat "LPS_" chiave)))
  (if (not (tblsearch "LAYER" nome))
    (entmake
      (list '(0 . "LAYER") '(100 . "AcDbSymbolTableRecord") '(100 . "AcDbLayerTableRecord")
            (cons 2 nome) '(70 . 0) (cons 62 (if d (caddr d) 7)) '(6 . "Continuous"))))
  nome)

;; layer per livello di protezione (es. LPS_ESPOSTO_III)
(defun lps:layer-lpl (chiave lpl / nome d)
  (setq d (assoc chiave *LPS-LAYER*))
  (setq nome (strcat (if d (cadr d) (strcat "LPS_" chiave)) "_" lpl))
  (if (not (tblsearch "LAYER" nome))
    (entmake
      (list '(0 . "LAYER") '(100 . "AcDbSymbolTableRecord") '(100 . "AcDbLayerTableRecord")
            (cons 2 nome) '(70 . 0) (cons 62 (if d (caddr d) 7)) '(6 . "Continuous"))))
  nome)

;; punto di progetto (m) -> punto del disegno
(defun lps:p (x y z)
  (list (+ (car *LPS-ORIGINE*) (* x *LPS-F*))
        (+ (cadr *LPS-ORIGINE*) (* y *LPS-F*))
        (+ (caddr *LPS-ORIGINE*) (* z *LPS-F*))))

;; distanza 3D tra punti in metri (lista x y z)
(defun lps:dist3 (a b)
  (sqrt (+ (expt (- (car b) (car a)) 2) (expt (- (cadr b) (cadr a)) 2) (expt (- (caddr b) (caddr a)) 2))))

(defun lps:num (v) (if (numberp v) (float v) 0.0))

;; xdata "LPS": codice, tipo, quantita' (pezzi o metri), unita'
(defun lps:xdata (ent codice tipo qta unita)
  (if (not (tblsearch "APPID" "LPS")) (regapp "LPS"))
  (if (and ent (entget ent))
    (entmod
      (append (entget ent)
              (list (list -3 (list "LPS"
                                   (cons 1000 (if (= codice "") "SENZA_CODICE" codice))
                                   (cons 1000 tipo)
                                   (cons 1040 qta)
                                   (cons 1000 unita)))))))
  ent)

;;; --------------------------------------------------------------------------
;;; Primitive di disegno (entmake: funzionano anche in AutoCAD LT)
;;; --------------------------------------------------------------------------

(defun lps:linea (p1 p2 lay)
  (entmake (list '(0 . "LINE") (cons 8 lay) (cons 10 p1) (cons 11 p2)))
  (entlast))

(defun lps:faccia (p1 p2 p3 p4 lay)
  (entmake (list '(0 . "3DFACE") (cons 8 lay) (cons 10 p1) (cons 11 p2) (cons 12 p3) (cons 13 p4)))
  (entlast))

(defun lps:testo (p h s lay)
  (entmake (list '(0 . "TEXT") (cons 8 lay) (cons 10 p) (cons 40 h) (cons 1 s)))
  (entlast))

;; polilinea 3D da lista di punti del disegno
(defun lps:poli3d (punti chiusa lay)
  (entmake (list '(0 . "POLYLINE") (cons 8 lay) '(66 . 1) '(10 0.0 0.0 0.0)
                 (cons 70 (if chiusa 9 8))))
  (foreach p punti
    (entmake (list '(0 . "VERTEX") (cons 8 lay) (cons 10 p) '(70 . 32))))
  (entmake (list '(0 . "SEQEND") (cons 8 lay)))
  (entlast))

;; cerchio orizzontale (normale Z)
(defun lps:cerchio (c r lay)
  (entmake (list '(0 . "CIRCLE") (cons 8 lay) (cons 10 c) (cons 40 r)))
  (entlast))

;; polilinea chiusa 2D (contorno) a quota z
(defun lps:contorno (punti2 z lay / l)
  (setq l (list '(0 . "LWPOLYLINE") '(100 . "AcDbEntity") (cons 8 lay) '(100 . "AcDbPolyline")
                (cons 90 (length punti2)) '(70 . 1) (cons 38 z)))
  (foreach p punti2 (setq l (append l (list (cons 10 p)))))
  (entmake l)
  (entlast))

;; esegue un comando con OSMODE spento, UCS mondo, eco spento
(defun lps:comando (args / os)
  (setq os (getvar "OSMODE"))
  (setvar "OSMODE" 0)
  (apply 'command args)
  (setvar "OSMODE" os)
  (entlast))

;;; --------------------------------------------------------------------------
;;; Blocchi OBO
;;; --------------------------------------------------------------------------

;; nome blocco dal codice articolo: "OBO_5218700"
(defun lps:nome-blocco (codice / s i c)
  (setq s "" i 1)
  (while (<= i (strlen codice))
    (setq c (substr codice i 1))
    (if (wcmatch c "#,@") (setq s (strcat s c)))
    (setq i (1+ i)))
  (strcat "OBO_" s))

;; blocco segnaposto (cubetto 40 mm con croce) se manca il blocco OBO
(defun lps:segnaposto (tipo / nome)
  (setq nome (strcat "LPS_SEGNAPOSTO_" (strcase tipo)))
  (if (not (tblsearch "BLOCK" nome))
    (progn
      (entmake (list '(0 . "BLOCK") (cons 2 nome) '(70 . 0) '(10 0.0 0.0 0.0)))
      (entmake (list '(0 . "CIRCLE") '(8 . "0") '(10 0.0 0.0 0.0) '(40 . 20.0)))
      (entmake (list '(0 . "LINE") '(8 . "0") '(10 -30.0 0.0 0.0) '(11 30.0 0.0 0.0)))
      (entmake (list '(0 . "LINE") '(8 . "0") '(10 0.0 -30.0 0.0) '(11 0.0 30.0 0.0)))
      (entmake (list '(0 . "LINE") '(8 . "0") '(10 0.0 0.0 0.0) '(11 0.0 0.0 40.0)))
      (entmake '((0 . "ENDBLK")))))
  nome)

;; inserisce il blocco del componente; restituisce l'entita'
(defun lps:inserisci (codice tipo pt rot lay / nome file sc def)
  (setq nome (lps:nome-blocco codice)
        sc (/ *LPS-F* *LPS-UNITA-BLOCCHI*))
  (cond
    ((and (/= codice "") (tblsearch "BLOCK" nome)) (setq def nome))
    ((and (/= codice "") *LPS-CARTELLA-BLOCCHI*
          (setq file (findfile (strcat *LPS-CARTELLA-BLOCCHI* "\\" nome ".dwg"))))
     (setq def (strcat nome "=" file)))
    ((and (/= codice "") *LPS-CARTELLA-BLOCCHI*
          (setq file (findfile (strcat *LPS-CARTELLA-BLOCCHI* "\\" codice ".dwg"))))
     (setq def (strcat nome "=" file)))
    (T (setq def (lps:segnaposto tipo) sc (/ *LPS-F* 1000.0))))
  (setvar "CLAYER" lay)
  (lps:comando (list "_.-INSERT" def pt sc sc rot))
  (if (and (/= codice "") (not (tblsearch "BLOCK" nome)))
    (setq *LPS-MANCANTI* (if (member codice *LPS-MANCANTI*) *LPS-MANCANTI* (cons codice *LPS-MANCANTI*))))
  (lps:xdata (entlast) codice tipo 1.0 "pz"))

;;; --------------------------------------------------------------------------
;;; Lettura del file .lpsdati
;;; --------------------------------------------------------------------------

(defun lps:leggi (file / f riga dati r)
  (setq f (open file "r"))
  (if (not f) (progn (lps:msg (strcat "Impossibile aprire " file)) (exit)))
  (while (setq riga (read-line f))
    (if (and (> (strlen riga) 1) (= (substr riga 1 1) "("))
      (progn
        (setq r (vl-catch-all-apply 'read (list riga)))
        (if (and r (not (vl-catch-all-error-p r)) (listp r))
          (setq dati (cons r dati))
          (lps:msg (strcat "Riga ignorata: " (substr riga 1 60)))))))
  (close f)
  (reverse dati))

;;; --------------------------------------------------------------------------
;;; Disegno dei record
;;; --------------------------------------------------------------------------

;; (CORPO "id" "nome" quotaBase gronda "tipo" colmo ((x y) ...))
(defun lps:corpo (r / id base gronda tipo colmo pts lay pd n i a b ent minx maxx miny maxy)
  (setq id (nth 1 r) base (lps:num (nth 3 r)) gronda (lps:num (nth 4 r))
        tipo (nth 5 r) colmo (nth 6 r) pts (nth 7 r)
        lay (lps:layer "EDIFICIO"))
  (setq pd (mapcar '(lambda (p) (lps:p (car p) (cadr p) 0.0)) pts))
  (if *LPS-SOLIDI*
    (progn
      (setq ent (lps:contorno (mapcar '(lambda (p) (list (car p) (cadr p))) pd)
                              (+ (caddr *LPS-ORIGINE*) (* base *LPS-F*)) lay))
      (lps:comando (list "_.EXTRUDE" ent "" (* gronda *LPS-F*))))
    (progn
      ;; pareti come 3DFACE e contorno della copertura
      (setq n (length pts) i 0)
      (while (< i n)
        (setq a (nth i pts) b (nth (rem (1+ i) n) pts))
        (lps:faccia (lps:p (car a) (cadr a) base) (lps:p (car b) (cadr b) base)
                    (lps:p (car b) (cadr b) (+ base gronda)) (lps:p (car a) (cadr a) (+ base gronda)) lay)
        (setq i (1+ i)))
      (lps:poli3d (mapcar '(lambda (p) (lps:p (car p) (cadr p) (+ base gronda))) pts) T lay)))
  ;; tetto a falde: linea di colmo sul lato lungo del rettangolo circoscritto
  (if (and (= tipo "falde") (numberp colmo))
    (progn
      (setq minx (apply 'min (mapcar 'car pts)) maxx (apply 'max (mapcar 'car pts))
            miny (apply 'min (mapcar 'cadr pts)) maxy (apply 'max (mapcar 'cadr pts)))
      (if (>= (- maxx minx) (- maxy miny))
        (lps:linea (lps:p minx (/ (+ miny maxy) 2.0) (+ base colmo))
                   (lps:p maxx (/ (+ miny maxy) 2.0) (+ base colmo)) lay)
        (lps:linea (lps:p (/ (+ minx maxx) 2.0) miny (+ base colmo))
                   (lps:p (/ (+ minx maxx) 2.0) maxy (+ base colmo)) lay))))
  (lps:testo (lps:p (car (car pts)) (cadr (car pts)) (+ base gronda)) (* 0.3 *LPS-F*) id (lps:layer "TESTI"))
  (setq *LPS-CONTA-CORPI* (1+ *LPS-CONTA-CORPI*)))

;; (ASTA "id" x y zBase altezza diametro "codice" "origine")
(defun lps:asta (r / id x y zb h d cod lay base punta ent)
  (setq id (nth 1 r) x (nth 2 r) y (nth 3 r) zb (lps:num (nth 4 r)) h (lps:num (nth 5 r))
        d (lps:num (nth 6 r)) cod (nth 7 r) lay (lps:layer "ASTE"))
  (if (<= d 0.0) (setq d 0.016))
  (setq base (lps:p x y zb) punta (lps:p x y (+ zb h)))
  (if *LPS-SOLIDI*
    (progn
      (setvar "CLAYER" lay)
      (setq ent (lps:comando (list "_.CYLINDER" base (* (/ d 2.0) *LPS-F*) (* h *LPS-F*)))))
    (progn
      (setq ent (lps:linea base punta lay))
      (lps:cerchio base (* (/ d 2.0) *LPS-F*) lay)))
  (lps:xdata ent cod "asta" 1.0 "pz")
  (lps:testo punta (* 0.2 *LPS-F*) (if (= cod "") id (strcat id " " cod)) (lps:layer "TESTI"))
  (setq *LPS-CONTA-ASTE* (1+ *LPS-CONTA-ASTE*)))

;; (CONDUTTORE "tipo" "materiale" sezione "codice" ((x y z) ...))
(defun lps:conduttore (r / tipo cod pts chiave lay ent l prec)
  (setq tipo (nth 1 r) cod (nth 4 r) pts (nth 5 r))
  (setq chiave (cond ((= tipo "calata") "CALATA")
                     ((member tipo '("terra" "anello" "dispersore" "uscita")) "TERRA")
                     (T "CAPTAZIONE")))
  (setq lay (lps:layer chiave))
  (setq ent (lps:poli3d (mapcar '(lambda (p) (lps:p (car p) (cadr p) (caddr p))) pts) nil lay))
  ;; lunghezza in metri
  (setq l 0.0 prec nil)
  (foreach p pts
    (if prec (setq l (+ l (lps:dist3 prec p))))
    (setq prec p))
  ;; l'uscita dal terreno e' un'asta: si conta a pezzi
  (if (= tipo "uscita")
    (lps:xdata ent cod tipo 1.0 "pz")
    (lps:xdata ent cod tipo l "m"))
  (setq *LPS-CONTA-COND* (1+ *LPS-CONTA-COND*)))

;; (SUPPORTO "tipo" x y z rot "codice") e (MORSETTO ...)
(defun lps:componente (r chiave)
  (lps:inserisci (nth 6 r) (nth 1 r) (lps:p (nth 2 r) (nth 3 r) (nth 4 r)) (lps:num (nth 5 r)) (lps:layer chiave))
  (setq *LPS-CONTA-COMP* (1+ *LPS-CONTA-COMP*)))

;; (PICCHETTO "id" x y zTesta lunghezza diametro "codice")
(defun lps:picchetto (r / x y zt l d cod lay ent)
  (setq x (nth 2 r) y (nth 3 r) zt (lps:num (nth 4 r)) l (lps:num (nth 5 r))
        d (lps:num (nth 6 r)) cod (nth 7 r) lay (lps:layer "TERRA"))
  (if (<= d 0.0) (setq d 0.02))
  (if *LPS-SOLIDI*
    (progn
      (setvar "CLAYER" lay)
      (setq ent (lps:comando (list "_.CYLINDER" (lps:p x y (- zt l)) (* (/ d 2.0) *LPS-F*) (* l *LPS-F*)))))
    (setq ent (lps:linea (lps:p x y zt) (lps:p x y (- zt l)) lay)))
  ;; picchetto componibile: numero di elementi da *LPS-ELEMENTO-PICCHETTO* m
  (lps:xdata ent cod "picchetto" (float (fix (+ 0.999 (/ l *LPS-ELEMENTO-PICCHETTO*)))) "pz")
  (setq *LPS-CONTA-COMP* (1+ *LPS-CONTA-COMP*)))

;; (ESPOSTA "LPL" x0 x1 y z passo): rettangolo rosso appena sopra la copertura
(defun lps:esposta (r / lpl x0 x1 y z s h lay)
  (setq lpl (nth 1 r) x0 (nth 2 r) x1 (nth 3 r) y (nth 4 r) z (+ (nth 5 r) 0.02) s (nth 6 r) h (/ s 2.0))
  (setq lay (lps:layer-lpl "ESPOSTO" lpl))
  (lps:faccia (lps:p (- x0 h) (- y h) z) (lps:p (+ x1 h) (- y h) z)
              (lps:p (+ x1 h) (+ y h) z) (lps:p (- x0 h) (+ y h) z) lay))

;; (PARETE "LPL" x y nx ny zDa zA larghezza): parte di parete esposta
(defun lps:parete (r / lpl x y nx ny za zb w tx ty lay)
  (setq lpl (nth 1 r) x (nth 2 r) y (nth 3 r) nx (nth 4 r) ny (nth 5 r)
        za (nth 6 r) zb (nth 7 r) w (/ (nth 8 r) 2.0))
  (setq tx (- ny) ty nx
        x (+ x (* nx 0.02)) y (+ y (* ny 0.02))
        lay (lps:layer-lpl "ESPOSTO" lpl))
  (lps:faccia (lps:p (- x (* tx w)) (- y (* ty w)) za) (lps:p (+ x (* tx w)) (+ y (* ty w)) za)
              (lps:p (+ x (* tx w)) (+ y (* ty w)) zb) (lps:p (- x (* tx w)) (- y (* ty w)) zb) lay))

;;; --------------------------------------------------------------------------
;;; Gestione errori e variabili di sistema
;;; --------------------------------------------------------------------------

(defun lps:salva-var ()
  (setq *LPS-VAR* (mapcar '(lambda (v) (cons v (getvar v))) '("OSMODE" "CMDECHO" "CLAYER" "ATTREQ")))
  (setvar "CMDECHO" 0)
  (setvar "ATTREQ" 0))

(defun lps:ripristina-var ()
  (foreach v *LPS-VAR* (setvar (car v) (cdr v)))
  (setq *LPS-VAR* nil))

(defun lps:errore (msg)
  (if *LPS-VAR* (lps:ripristina-var))
  (if (not (member msg '("Function cancelled" "quit / exit abort" "console break")))
    (lps:msg (strcat "LPS errore: " msg)))
  (setq *error* *LPS-ERRORE-PREC*)
  (princ))

(defun lps:inizio ()
  (setq *LPS-ERRORE-PREC* *error* *error* lps:errore)
  (lps:salva-var)
  (if (/= (getvar "WORLDUCS") 1) (command "_.UCS" "_W")))

(defun lps:fine ()
  (lps:ripristina-var)
  (setq *error* *LPS-ERRORE-PREC*))

;;; --------------------------------------------------------------------------
;;; Comandi
;;; --------------------------------------------------------------------------

(defun c:LPS ()
  (lps:msg (strcat "Progettazione LPS " *LPS-VERSIONE* " - comandi:"))
  (lps:msg "  LPS-IMPORTA   disegna il progetto esportato dal sito (.lpsdati)")
  (lps:msg "  LPS-SFERA     disegna la sfera rotolante di un livello")
  (lps:msg "  LPS-ESPORTA   esporta i contorni dell'edificio verso il sito")
  (lps:msg "  LPS-DISTINTA  distinta dei componenti (codici, pezzi, metri) + CSV")
  (lps:msg "  LPS-BLOCCHI   cartella dei blocchi OBO")
  (princ))

(defun c:LPS-BLOCCHI (/ f)
  (setq f (getfiled "Scegli un qualsiasi blocco nella cartella dei blocchi OBO" "" "dwg" 0))
  (if f
    (progn
      (setq *LPS-CARTELLA-BLOCCHI* (vl-filename-directory f))
      (vl-catch-all-apply 'setenv (list "LPS_BLOCCHI" *LPS-CARTELLA-BLOCCHI*))
      (lps:msg (strcat "Cartella blocchi: " *LPS-CARTELLA-BLOCCHI*))))
  (princ))

(defun c:LPS-IMPORTA (/ file dati o tipo n)
  (lps:inizio)
  (if (not *LPS-CARTELLA-BLOCCHI*)
    (progn
      (setq o (vl-catch-all-apply 'getenv (list "LPS_BLOCCHI")))
      (if (and o (not (vl-catch-all-error-p o))) (setq *LPS-CARTELLA-BLOCCHI* o))))
  (setq file (getfiled "File di progetto LPS" "" "lpsdati" 0))
  (if (not file) (progn (lps:fine) (exit)))
  (setq dati (lps:leggi file))
  (if (not (assoc 'LPSDATI dati))
    (progn (lps:msg "Il file non e' un file .lpsdati valido.") (lps:fine) (exit)))
  (setq *LPS-F* (lps:fattore)
        *LPS-SOLIDI* (lps:solidi-p)
        *LPS-MANCANTI* nil
        *LPS-CONTA-CORPI* 0 *LPS-CONTA-ASTE* 0 *LPS-CONTA-COND* 0 *LPS-CONTA-COMP* 0)
  (setq o (getpoint "\nPunto di inserimento dell'origine di progetto <0,0,0>: "))
  (setq *LPS-ORIGINE* (if o (if (caddr o) o (list (car o) (cadr o) 0.0)) '(0.0 0.0 0.0)))
  (if (not *LPS-SOLIDI*)
    (lps:msg "AutoCAD LT: aste e corpi disegnati come linee e facce (senza solidi 3D)."))
  (setq n 0)
  (foreach r dati
    (setq tipo (car r))
    (cond
      ((eq tipo 'CORPO) (lps:corpo r))
      ((eq tipo 'ASTA) (lps:asta r))
      ((eq tipo 'CONDUTTORE) (lps:conduttore r))
      ((eq tipo 'SUPPORTO) (lps:componente r "SUPPORTI"))
      ((eq tipo 'MORSETTO) (lps:componente r "MORSETTI"))
      ((eq tipo 'PICCHETTO) (lps:picchetto r))
      ((eq tipo 'ESPOSTA) (lps:esposta r))
      ((eq tipo 'PARETE) (lps:parete r))
      ((eq tipo 'PROGETTO) (setq *LPS-PROGETTO* r)))
    (setq n (1+ n)))
  (lps:fine)
  (lps:msg (strcat "LPS-IMPORTA: " (itoa *LPS-CONTA-CORPI*) " corpi, "
                   (itoa *LPS-CONTA-ASTE*) " aste, " (itoa *LPS-CONTA-COND*) " conduttori, "
                   (itoa *LPS-CONTA-COMP*) " componenti."))
  (if *LPS-MANCANTI*
    (progn
      (lps:msg "Blocchi OBO non trovati (inseriti segnaposto): ")
      (foreach c *LPS-MANCANTI* (princ (strcat c " ")))
      (lps:msg "Usa LPS-BLOCCHI per indicare la cartella dei blocchi.")))
  (command "_.ZOOM" "_E")
  (princ))

(defun c:LPS-SFERA (/ lpl r c f lay i a n pts)
  (lps:inizio)
  (setq f (lps:fattore))
  (initget "I II III IV")
  (setq lpl (getkword "\nLivello di protezione [I/II/III/IV] <III>: "))
  (if (not lpl) (setq lpl "III"))
  (setq r (* (cdr (assoc lpl *LPS-RAGGI*)) f))
  (setq c (getpoint (strcat "\nCentro della sfera (r = " (rtos (/ r f) 2 1) " m): ")))
  (if c
    (progn
      (if (not (caddr c)) (setq c (list (car c) (cadr c) 0.0)))
      (setq lay (lps:layer-lpl "SFERA" lpl))
      (if (lps:solidi-p)
        (progn (setvar "CLAYER" lay) (lps:comando (list "_.SPHERE" c r)))
        (progn
          ;; tre cerchi ortogonali come polilinee 3D (72 lati)
          (lps:cerchio c r lay)
          (setq n 72)
          (foreach piano '(0 1)
            (setq pts nil i 0)
            (while (< i n)
              (setq a (/ (* 2.0 pi i) n))
              (setq pts (cons (if (= piano 0)
                                (list (+ (car c) (* r (cos a))) (cadr c) (+ (caddr c) (* r (sin a))))
                                (list (car c) (+ (cadr c) (* r (cos a))) (+ (caddr c) (* r (sin a)))))
                              pts))
              (setq i (1+ i)))
            (lps:poli3d (reverse pts) T lay))))))
  (lps:fine)
  (princ))

;; numero in JSON
(defun lps:jnum (v) (rtos v 2 4))

;; stringa in JSON (toglie virgolette e barre)
(defun lps:jstr (s / o i c)
  (setq o "" i 1)
  (while (<= i (strlen s))
    (setq c (substr s i 1))
    (setq o (strcat o (cond ((= c "\"") "'") ((= c "\\") "/") (T c))))
    (setq i (1+ i)))
  (strcat "\"" o "\""))

(defun c:LPS-ESPORTA (/ f ss i e d pts base h n file fh corpi testo)
  (lps:inizio)
  (setq f (lps:fattore))
  (lps:msg "Seleziona i contorni chiusi dei corpi di fabbrica (polilinee).")
  (lps:msg "Quota = elevazione della polilinea; altezza = spessore, se impostato.")
  (setq ss (ssget '((0 . "LWPOLYLINE") (-4 . "&") (70 . 1))))
  (if (not ss) (progn (lps:fine) (exit)))
  (setq i 0 corpi nil)
  (while (< i (sslength ss))
    (setq e (ssname ss i) d (entget e) pts nil)
    (foreach g d (if (= (car g) 10) (setq pts (cons (list (/ (cadr g) f) (/ (caddr g) f)) pts))))
    (setq pts (reverse pts))
    (setq base (/ (lps:num (cdr (assoc 38 d))) f))
    (setq h (/ (lps:num (cdr (assoc 39 d))) f))
    (if (<= h 0.0)
      (progn
        (initget 7)
        (setq h (getreal (strcat "\nAltezza in gronda del corpo " (itoa (1+ i)) " (m): ")))))
    (setq corpi
      (cons (strcat "{\"id\":" (lps:jstr (strcat "CAD" (itoa (1+ i))))
                    ",\"nome\":" (lps:jstr (strcat "Corpo " (itoa (1+ i))))
                    ",\"impronta\":["
                    (lps:unisci (mapcar '(lambda (p) (strcat "[" (lps:jnum (car p)) "," (lps:jnum (cadr p)) "]")) pts) ",")
                    "],\"quotaBase\":" (lps:jnum base)
                    ",\"altezzaGronda\":" (lps:jnum h)
                    ",\"tipoTetto\":\"piano\"}")
            corpi))
    (setq i (1+ i)))
  (setq testo (strcat "{\"versione\":\"1\",\"unita\":\"m\",\"corpi\":[" (lps:unisci (reverse corpi) ",") "]}"))
  (setq file (getfiled "Salva l'edificio per il sito" "edificio_da_CAD" "json" 1))
  (if file
    (progn
      (setq fh (open file "w"))
      (write-line testo fh)
      (close fh)
      (lps:msg (strcat "Esportati " (itoa (sslength ss)) " corpi in " file))))
  (lps:fine)
  (princ))

;; unisce stringhe con un separatore
(defun lps:unisci (l sep / o)
  (setq o "")
  (foreach s l (setq o (if (= o "") s (strcat o sep s))))
  o)

(defun c:LPS-DISTINTA (/ ss i e x d cod tipo q u voce tab file fh)
  (setq ss (ssget "_X" '((-3 ("LPS")))))
  (if (not ss) (progn (lps:msg "Nessun componente LPS nel disegno.") (exit)))
  (setq i 0 tab nil)
  (while (< i (sslength ss))
    (setq e (ssname ss i)
          x (cdr (car (cdr (assoc -3 (entget e '("LPS")))))))
    ;; x = ((1000 . codice) (1000 . tipo) (1040 . qta) (1000 . unita))
    (setq cod (cdr (nth 0 x)) tipo (cdr (nth 1 x)) q (cdr (nth 2 x)) u (cdr (nth 3 x)))
    (setq voce (assoc cod tab))
    (if voce
      (setq tab (subst (list cod
                             (if (wcmatch (cadr voce) (strcat "*" tipo "*")) (cadr voce) (strcat (cadr voce) "/" tipo))
                             (+ (caddr voce) q) u)
                       voce tab))
      (setq tab (cons (list cod tipo q u) tab)))
    (setq i (1+ i)))
  (setq tab (vl-sort tab '(lambda (a b) (< (car a) (car b)))))
  (lps:msg "Codice          Tipo            Quantita'")
  (foreach v tab
    (lps:msg (strcat (car v) "  " (cadr v) "  "
                     (if (= (cadddr v) "m") (strcat (rtos (caddr v) 2 1) " m")
                         (strcat (rtos (caddr v) 2 0) " pz")))))
  (setq file (strcat (getvar "DWGPREFIX") (vl-filename-base (getvar "DWGNAME")) "_distinta_LPS.csv"))
  (setq fh (open file "w"))
  (if fh
    (progn
      (write-line "Codice;Tipo;Quantita;Unita" fh)
      (foreach v tab
        (write-line (strcat (car v) ";" (cadr v) ";"
                            (vl-string-subst "," "." (rtos (caddr v) 2 2)) ";" (cadddr v)) fh))
      (close fh)
      (lps:msg (strcat "Distinta salvata in " file))))
  (princ))

(lps:msg (strcat "Progettazione LPS " *LPS-VERSIONE* " caricato. Digita LPS per l'elenco dei comandi."))
(princ)
