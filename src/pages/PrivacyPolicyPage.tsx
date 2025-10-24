import Header from "@/components/Header";
import { LazyFooter } from "@/components/LazyComponents";
import { useBodyClass } from "@/hooks/useBodyClass";

const PrivacyPolicyPage = () => {
  useBodyClass("privacy-policy-page");

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-4xl pt-[calc(env(safe-area-inset-top)+4rem+3rem)]">
        <h1 className="text-4xl font-bold text-foreground mb-8 text-center">
          Politica de confidențialitate (GDPR)
        </h1>
        
        <div className="bg-card rounded-lg shadow-lg p-8 space-y-6 text-foreground">
          <p className="text-sm text-muted-foreground text-center mb-8">
            Ultima actualizare: octombrie 2025
          </p>

          <p className="text-base leading-relaxed">
            RezervaArena SRL respectă confidențialitatea și protecția datelor cu caracter personal ale tuturor utilizatorilor platformei RezervaArena.com.
            Această politică explică ce date colectăm, de ce le colectăm, cum le folosim și ce drepturi ai în legătură cu datele tale personale, în conformitate cu Regulamentul (UE) 2016/679 (GDPR).
          </p>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">1. Operatorul de date</h2>
            <p className="text-base leading-relaxed mb-4">
              Operatorul responsabil de prelucrarea datelor tale este:
            </p>
            <div className="bg-secondary/50 p-4 rounded-md">
              <p className="font-semibold">RezervaArena SRL</p>
              <p>E-mail de contact: rezervaarena@gmail.com</p>
              <p>Site: <a href="https://rezervaarena.com" className="text-primary hover:underline">https://rezervaarena.com</a></p>
            </div>
            <p className="text-base leading-relaxed mt-4">
              RezervaArena SRL acționează în calitate de operator de date pentru toate informațiile colectate prin intermediul site-ului și aplicației RezervaArena.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">2. Datele personale colectate</h2>
            <p className="text-base leading-relaxed mb-4">
              În cadrul procesului de creare a unui cont pe platformă, colectăm următoarele categorii de date personale:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base">
              <li>Nume și prenume</li>
              <li>Adresă de e-mail</li>
              <li>Număr de telefon</li>
              <li>Parolă (criptată)</li>
              <li>Date de autentificare Google, dacă alegi logarea prin Google</li>
            </ul>
            <p className="text-base leading-relaxed mt-4">
              De asemenea, putem colecta automat informații tehnice precum adresa IP, tipul de browser, sistemul de operare și data/ora accesării, în scopuri de securitate și optimizare a performanței.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">3. Scopul prelucrării datelor</h2>
            <p className="text-base leading-relaxed mb-4">
              Datele tale sunt utilizate exclusiv pentru:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base">
              <li>Crearea și administrarea contului tău RezervaArena</li>
              <li>Permisiunea de autentificare și securizarea accesului</li>
              <li>Gestionarea rezervărilor efectuate în platformă</li>
              <li>Comunicări necesare pentru confirmarea sau modificarea rezervărilor</li>
              <li>Optimizarea experienței de utilizare și a funcționalității site-ului</li>
            </ul>
            <p className="text-base leading-relaxed mt-4 font-medium">
              RezervaArena nu trimite newslettere, mesaje comerciale sau campanii de marketing fără consimțământul tău explicit.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">4. Baza legală a prelucrării</h2>
            <p className="text-base leading-relaxed mb-4">
              Prelucrarea datelor tale personale se bazează pe următoarele temeiuri legale (art. 6 alin. (1) GDPR):
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base">
              <li><strong>Executarea contractului</strong> (crearea și administrarea contului de utilizator, efectuarea rezervărilor)</li>
              <li><strong>Interes legitim</strong> (asigurarea funcționării și securității platformei)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">5. Stocarea datelor</h2>
            <p className="text-base leading-relaxed mb-4">
              Datele tale sunt stocate în mod securizat în baza de date Supabase, localizată în centrul de date EU-central-1.
              Supabase oferă măsuri tehnice și organizaționale conforme cu cerințele GDPR și un Data Processing Agreement (DPA) valabil.
            </p>
            <p className="text-base leading-relaxed">
              Parolele sunt stocate criptat (hash), iar accesul la baza de date este limitat strict la personalul autorizat RezervaArena SRL.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">6. Durata de păstrare a datelor</h2>
            <p className="text-base leading-relaxed">
              Datele sunt păstrate doar atât timp cât contul tău este activ.
              La ștergerea contului, toate informațiile personale asociate sunt eliminate definitiv din baza de date în termen de maximum 30 de zile.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">7. Partajarea datelor cu terți</h2>
            <p className="text-base leading-relaxed mb-4">
              RezervaArena SRL nu vinde, nu închiriază și nu divulgă datele tale personale către terți, cu excepția furnizorilor esențiali pentru funcționarea serviciului (ex. Supabase, Google Auth).
            </p>
            <p className="text-base leading-relaxed">
              Toți acești furnizori respectă standardele GDPR și prelucrează datele doar în numele și conform instrucțiunilor RezervaArena SRL.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">8. Drepturile tale conform GDPR</h2>
            <p className="text-base leading-relaxed mb-4">
              Ai următoarele drepturi cu privire la datele personale:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base">
              <li><strong>Dreptul de acces</strong> – poți solicita informații despre datele tale stocate</li>
              <li><strong>Dreptul la rectificare</strong> – poți cere corectarea datelor inexacte sau incomplete</li>
              <li><strong>Dreptul la ștergere („dreptul de a fi uitat")</strong> – poți solicita ștergerea completă a contului și a datelor asociate</li>
              <li><strong>Dreptul la restricționare</strong> – poți cere limitarea temporară a prelucrării datelor</li>
              <li><strong>Dreptul la portabilitate</strong> – poți solicita exportul datelor într-un format standard (ex. JSON/CSV)</li>
              <li><strong>Dreptul de opoziție</strong> – poți refuza utilizarea datelor pentru anumite scopuri</li>
            </ul>
            <p className="text-base leading-relaxed mt-4">
              Pentru exercitarea acestor drepturi, trimite o solicitare la <a href="mailto:rezervaarena@gmail.com" className="text-primary hover:underline font-medium">rezervaarena@gmail.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">9. Securitatea datelor</h2>
            <p className="text-base leading-relaxed mb-4">
              RezervaArena SRL aplică măsuri tehnice și organizatorice riguroase:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base">
              <li>Stocare criptată a parolelor</li>
              <li>Conexiuni HTTPS securizate</li>
              <li>Control strict al accesului la date</li>
              <li>Backup periodic și monitorizare a sistemelor</li>
            </ul>
            <p className="text-base leading-relaxed mt-4">
              Deși luăm toate măsurile rezonabile pentru protejarea datelor, niciun sistem online nu poate fi complet imun la riscuri. În cazul unui incident de securitate, utilizatorii vor fi notificați conform prevederilor legale.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">10. Cookie-uri și tehnologii similare</h2>
            <p className="text-base leading-relaxed mb-4">
              RezervaArena utilizează cookie-uri esențiale pentru funcționarea platformei (de exemplu, pentru menținerea sesiunii de autentificare).
              Nu folosim cookie-uri de marketing, publicitate sau urmărire fără consimțământul explicit al utilizatorului.
            </p>
            <p className="text-base leading-relaxed">
              Poți gestiona preferințele privind cookie-urile din setările browserului tău.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">11. Transferul datelor în afara UE</h2>
            <p className="text-base leading-relaxed">
              Supabase poate utiliza infrastructură cloud în spațiul economic european (EU-central-1).
              RezervaArena SRL nu transferă și nu stochează datele personale în afara Uniunii Europene.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">12. Modificări ale politicii de confidențialitate</h2>
            <p className="text-base leading-relaxed">
              Această politică poate fi actualizată periodic.
              Orice modificare va fi publicată pe această pagină, împreună cu data ultimei actualizări.
              Te încurajăm să consulți regulat această secțiune pentru a fi la curent cu modul în care protejăm datele tale.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">13. Contact</h2>
            <p className="text-base leading-relaxed mb-4">
              Pentru orice întrebare, solicitare sau sesizare privind protecția datelor, ne poți contacta la:
            </p>
            <p className="text-base leading-relaxed mb-4">
              📧 <a href="mailto:rezervaarena@gmail.com" className="text-primary hover:underline font-medium">rezervaarena@gmail.com</a>
            </p>
            <p className="text-base leading-relaxed">
              Dacă consideri că drepturile tale nu au fost respectate, poți depune o plângere la:<br />
              <strong>Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP)</strong><br />
              <a href="https://www.dataprotection.ro" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.dataprotection.ro</a>
            </p>
          </section>

          <section className="bg-primary/10 p-6 rounded-lg border-l-4 border-primary">
            <h2 className="text-2xl font-bold text-foreground mb-4">🔹 Concluzie</h2>
            <p className="text-base leading-relaxed">
              RezervaArena SRL își asumă angajamentul deplin de a proteja confidențialitatea utilizatorilor și de a prelucra datele personale în conformitate cu legislația europeană și națională privind protecția datelor.
            </p>
          </section>
        </div>
      </main>
      <LazyFooter />
    </div>
  );
};

export default PrivacyPolicyPage;
