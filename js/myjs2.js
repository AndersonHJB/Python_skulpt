const output = document.getElementById("output");
      const code = document.getElementById("code");

      function addToOutput(s) {
        output.value += ">>>" + code.value + "\n" + s + "\n";
      }

      output.value = "Initializing...\n";
      // init Pyodide
      async function main() {
        let pyodide = await loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.18.1/full/",
        });
        output.value += "Ready!\n";
        return pyodide;
      }
      let pyodideReadyPromise = main();

      async function evaluatePython() {
        let pyodide = await pyodideReadyPromise;
        try {
          let output = pyodide.runPython(code.value);
          addToOutput(output);
        } catch (err) {
          addToOutput(err);
        }
      }