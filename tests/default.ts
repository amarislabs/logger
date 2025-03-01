import { LogLevels, createConsola } from "consola";
import { DefaultReporter } from "#/index";

const logger = createConsola({ formatOptions: { date: true } }).setReporters([
    new DefaultReporter({ padding: 2, addTypeColon: true, dateFirstPosition: false }),
]);

logger.level = LogLevels.verbose;

logger.info("Lorem ipsum odor amet, consectetuer!");
logger.info("Lorem ipsum odor amet, consectetuer!");
