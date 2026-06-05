export class TransactionController {
  constructor({ transactionService }) {
    this.transactionService = transactionService;
  }

  adminList = async (req, res, next) => {
    try {
      const result = await this.transactionService.adminList(req.query);
      res.status(200).json({ data: result });
    } catch (e) {
      next(e);
    }
  };
}

