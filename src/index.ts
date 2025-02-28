import { createConsola } from "consola";
import { DefaultReporter } from "#/reporters/default";

const logger = createConsola().setReporters([new DefaultReporter({ addTypeColon: true })]);

logger.info("Lorem ipsum odor amet, consectetuer!");
logger.info("Lorem ipsum odor amet, consectetuer!");

// logger.log("");
