import { ArgsSchema } from "./applicationConfig";
import { run } from "./model/main";

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Invalid number of arguments");
    process.exit(1);
  }

  const rawArgs = {
    regions: args[0],
    filename: args[1],
    date: args[2],
  };

  const parsedArgs = ArgsSchema.safeParse(rawArgs);

  if (!parsedArgs.success) {
    console.error("Invalid arguments:", parsedArgs.error.format());
    process.exit(1);
  }

  run(parsedArgs.data);
}

main();
