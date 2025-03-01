import { createConsola } from "consola";
import { DefaultReporter } from "#/index";

const logger = createConsola({ formatOptions: { date: true } }).setReporters([
    new DefaultReporter({ padding: 2, addTypeColon: true, dateFirstPosition: false }),
]);

logger.info("Lorem ipsum odor amet, consectetuer!");
logger.info("Lorem ipsum odor amet, consectetuer!");
