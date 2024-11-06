import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import { Search, BookOpen } from "lucide-react";
import "./styles.css";

const sources = [
  { id: "modeleFR", label: "Modèle (FR)", col: 1, sourceCol: 0 },
  { id: "modeleEN", label: "Modèle (EN)", col: 3, sourceCol: 0 },
  { id: "directiveFR", label: "Directive (FR)", col: 6, sourceCol: 5 },
  { id: "directiveEN", label: "Directive (EN)", col: 8, sourceCol: 5 },
  { id: "cgi", label: "CGI", col: 11, sourceCol: 10 },
];

// Fonction utilitaire pour formater la source
const formatSource = (source, sourceType) => {
  if (!source) return "";

  if (source.match(/^\d/)) {
    switch (sourceType) {
      case "modeleFR":
      case "modeleEN":
        return `Modèle de règles, art. ${source}`;
      case "directiveFR":
      case "directiveEN":
        return `Dir. GloBE, art. ${source}`;
      case "cgi":
        return `CGI, art. ${source}`;
      default:
        return source;
    }
  }
  return source;
};

// Fonction pour formater une définition en HTML
const formatDefinition = (text) => {
  if (!text) return { __html: "" };

  // Créer un tableau pour stocker les lignes de HTML
  const formattedLines = [];
  let currentListLevel = 0;
  let isInList = false;

  // Convertir les retours à la ligne en tableau et nettoyer les lignes vides
  let lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line);

  // Expressions régulières pour chaque type de liste
  const letterListRegex = /^\([a-z]\)|^[a-z]\)/i; // (a), a)
  const romanListRegex = /^\([ivx]+\)|^[ivx]+\)|^[ivx]+\./i; // (i), i), i.
  const numberListRegex = /^\(\d+\)|^\d+\)|^\d+°/; // (1), 1), 1°
  const thirdLevelRegex = /^[A-Z]\)|^\([A-Z]\)|^[α-ω]\)|^\([α-ω]\)/i; // A), (A), α), (α)

  // Fonction pour vérifier si une ligne commence une liste en chiffres romains
  const isStartOfRomanList = (currentIndex) => {
    if (currentIndex >= lines.length - 1) return false;

    const currentMatch = lines[currentIndex].match(romanListRegex);
    if (!currentMatch) return false;

    // Vérifie si le suivant est un numéro romain
    const nextLine = lines[currentIndex + 1];
    const nextMatch = nextLine ? nextLine.match(romanListRegex) : null;

    if (nextMatch) {
      const currentNumber = currentMatch[0]
        .replace(/[()]/g, "")
        .replace(/\.$/, "")
        .toLowerCase();
      const nextNumber = nextMatch[0]
        .replace(/[()]/g, "")
        .replace(/\.$/, "")
        .toLowerCase();

      // Séquence valide de chiffres romains : i->ii, ii->iii, etc.
      const romanSequence = [
        "i",
        "ii",
        "iii",
        "iv",
        "v",
        "vi",
        "vii",
        "viii",
        "ix",
        "x",
      ];
      const currentIndex = romanSequence.indexOf(currentNumber);
      const nextIndex = romanSequence.indexOf(nextNumber);

      return currentIndex !== -1 && nextIndex === currentIndex + 1;
    }

    return false;
  };

  // Fonction pour déterminer le niveau d'une ligne
  const getLineLevel = (line, index) => {
    // Vérifier d'abord si c'est une liste en chiffres romains
    if (romanListRegex.test(line)) {
      if (
        isStartOfRomanList(index) ||
        (index > 0 && romanListRegex.test(lines[index - 1]))
      ) {
        return 2; // C'est une liste en chiffres romains (niveau 2)
      }
      // Si ce n'est pas une liste en chiffres romains, c'est probablement un "i)" d'une liste alphabétique
      return 1;
    }

    // Les autres types de liste
    if (letterListRegex.test(line)) return 1;
    if (numberListRegex.test(line)) return 1;
    if (thirdLevelRegex.test(line)) return 3;

    return 0; // Pas une liste
  };

  // Traiter chaque ligne
  lines.forEach((line, index) => {
    const lineLevel = getLineLevel(line, index);

    if (lineLevel > 0) {
      formattedLines.push(`<li class="definition-list-item definition-list-level${lineLevel}">
        <span class="list-marker">${
          line.match(/^[^a-zA-Z0-9]*([(]?[a-zA-Z0-9]+[).:])/)[1]
        }</span>
        <span class="list-content">${line.replace(
          /^[^a-zA-Z0-9]*([(]?[a-zA-Z0-9]+[).:])\s*/,
          ""
        )}</span>
      </li>`);
    } else {
      formattedLines.push(`<div class="definition-paragraph">${line}</div>`);
    }
  });

  // Fermer les listes restantes
  while (currentListLevel > 0) {
    formattedLines.push("</ul>");
    currentListLevel--;
  }

  return { __html: formattedLines.join("\n") };
};

const GlobeLexicon = () => {
  const [terms, setTerms] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSource, setSelectedSource] = useState(sources[0]);
  const [compareSource, setCompareSource] = useState(sources[1]);
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch("/globeLexicon.csv");
        const text = await response.text();

        Papa.parse(text, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            const data = results.data.slice(3);
            const processedData = data
              .map((row) => ({
                modeleFR: {
                  term: row[1],
                  def: row[2],
                  source: row[0],
                },
                modeleEN: {
                  term: row[3],
                  def: row[4],
                  source: row[0],
                },
                directiveFR: {
                  term: row[6],
                  def: row[7],
                  source: row[5],
                },
                directiveEN: {
                  term: row[8],
                  def: row[9],
                  source: row[5],
                },
                cgi: {
                  term: row[11],
                  def: row[12],
                  source: row[10],
                },
              }))
              .filter(
                (term) =>
                  term.modeleFR.term ||
                  term.modeleEN.term ||
                  term.directiveFR.term ||
                  term.directiveEN.term ||
                  term.cgi.term
              );
            setTerms(processedData);
          },
        });
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };

    loadData();
  }, []);

  const filteredTerms = terms.filter((term) =>
    term[selectedSource.id].term
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Lexique GloBE</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <label className="block mb-2">Rechercher dans :</label>
          <select
            className="search-select w-full mb-4"
            value={selectedSource.id}
            onChange={(e) => {
              const newSource = sources.find((s) => s.id === e.target.value);
              setSelectedSource(newSource);
              if (compareSource.id === newSource.id) {
                setCompareSource(sources.find((s) => s.id !== newSource.id));
              }
            }}
          >
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.label}
              </option>
            ))}
          </select>

          <div className="search-container">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                className="search-input pl-10"
                placeholder="Rechercher un terme..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
              />
            </div>

            {isDropdownOpen && (
              <div className="dropdown-list">
                {filteredTerms.map((term, index) => (
                  <div
                    key={index}
                    className={`dropdown-item ${
                      selectedTerm === term ? "selected" : ""
                    }`}
                    onClick={() => {
                      setSelectedTerm(term);
                      setIsDropdownOpen(false);
                    }}
                  >
                    {term[selectedSource.id].term}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedTerm && (
          <div className="definition-card">
            <h2 className="section-title">Termes équivalents</h2>
            <div className="equivalent-terms">
              {sources.map(
                (source) =>
                  selectedTerm[source.id]?.term && (
                    <div key={source.id} className="equivalent-term">
                      <span className="font-medium text-gray-700">
                        {source.label} :{" "}
                      </span>
                      <span className="ml-2">
                        {selectedTerm[source.id].term}
                      </span>
                    </div>
                  )
              )}
            </div>

            {/* Première définition */}
            <div className="definition-card">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center">
                  <select
                    className="heading-select"
                    value={selectedSource.id}
                    onChange={(e) => {
                      const newSource = sources.find(
                        (s) => s.id === e.target.value
                      );
                      setSelectedSource(newSource);
                      if (compareSource.id === newSource.id) {
                        setCompareSource(
                          sources.find((s) => s.id !== newSource.id)
                        );
                      }
                    }}
                  >
                    {sources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.label}
                      </option>
                    ))}
                  </select>
                  <span className="mx-2">-</span>
                  <span>{selectedTerm[selectedSource.id].term}</span>
                </h2>
                {selectedTerm[selectedSource.id].source && (
                  <span className="source-tag">
                    <BookOpen className="h-4 w-4 mr-2" />
                    {formatSource(
                      selectedTerm[selectedSource.id].source,
                      selectedSource.id
                    )}
                  </span>
                )}
              </div>
              <div
                className="definition-content"
                dangerouslySetInnerHTML={formatDefinition(
                  selectedTerm[selectedSource.id].def
                )}
              />
            </div>

            {/* Section de comparaison */}
            <div className="definition-card">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center">
                  <select
                    className="heading-select"
                    value={compareSource.id}
                    onChange={(e) =>
                      setCompareSource(
                        sources.find((s) => s.id === e.target.value)
                      )
                    }
                  >
                    {sources
                      .filter((s) => s.id !== selectedSource.id)
                      .map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.label}
                        </option>
                      ))}
                  </select>
                  <span className="mx-2">-</span>
                  <span>{selectedTerm[compareSource.id].term}</span>
                </h2>
                {selectedTerm[compareSource.id].source && (
                  <span className="source-tag">
                    <BookOpen className="h-4 w-4 mr-2" />
                    {formatSource(
                      selectedTerm[compareSource.id].source,
                      compareSource.id
                    )}
                  </span>
                )}
              </div>
              <div
                className="definition-content"
                dangerouslySetInnerHTML={formatDefinition(
                  selectedTerm[compareSource.id].def
                )}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobeLexicon;
