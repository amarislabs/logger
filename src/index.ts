import { createConsola } from "consola";
import { ContainerReporter } from "#/reporters/container";

const logger = createConsola().setReporters([new ContainerReporter({})]);

// logger.log("");
logger.info("Lorem ipsum odor amet, consectetuer!");
// logger.log("");
logger.log("Lorem ipsum odor amet, consectetuer adipiscing elit. Inceptos vehicula fringilla hendrerit commodo");
logger.log("[[-]]");
logger.log("Lorem ipsum odor amet, consectetuer adipiscing elit. Inceptos vehicula fringilla hendrerit commodo");
logger.info("Lorem ipsum odor amet, consectetuer!");

// logger.log("");
