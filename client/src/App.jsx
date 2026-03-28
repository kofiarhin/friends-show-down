import { useEffect } from "react";

const App = () => {
  useEffect(() => {
    const getHealth = async () => {
      const res = await fetch("http://localhost:5000/api/health");
      if (!res.ok) {
        throw new Error("something went wrong");
      }

      const data = await res.json();
      console.log({ data });
    };

    getHealth();
    6;
  }, []);
  return <div>App</div>;
};

export default App;
